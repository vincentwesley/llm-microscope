"""Independent fp32 numpy GPT-2 used only to produce test fixtures.

    python3 -I scripts/reference.py path/to/model.safetensors

Reads tests/fixtures/prompts.json, writes tests/fixtures/reference.json with, per prompt:
the top-10 next-token ids and logits at the last position, the logit-lens top-1 at the last
position for every layer, and one attention row (layer 5, head 1, last query).
"""
import json
import struct
import sys

import numpy as np


def load(path):
    with open(path, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(n))
        raw = f.read()
    out = {}
    for name, info in header.items():
        if name == "__metadata__":
            continue
        a, b = info["data_offsets"]
        out[name] = np.frombuffer(raw[a:b], dtype=np.float32).reshape(info["shape"])
    return out


def ln(x, g, b, eps=1e-5):
    mu = x.mean(-1, keepdims=True)
    var = ((x - mu) ** 2).mean(-1, keepdims=True)
    return (x - mu) / np.sqrt(var + eps) * g + b


def gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))


def softmax(x):
    e = np.exp(x - x.max(-1, keepdims=True))
    return e / e.sum(-1, keepdims=True)


def forward(w, ids):
    T = len(ids)
    x = w["wte.weight"][ids] + w["wpe.weight"][:T]
    resid = [x]
    attn_rows = {}
    mask = np.triu(np.full((T, T), -1e10, dtype=np.float32), 1)
    for l in range(12):
        p = f"h.{l}."
        h = ln(x, w[p + "ln_1.weight"], w[p + "ln_1.bias"])
        qkv = h @ w[p + "attn.c_attn.weight"] + w[p + "attn.c_attn.bias"]
        q, k, v = np.split(qkv, 3, axis=-1)
        heads = []
        for hd in range(12):
            s = slice(hd * 64, hd * 64 + 64)
            a = softmax(q[:, s] @ k[:, s].T / 8.0 + mask)
            attn_rows[(l, hd)] = a[-1]
            heads.append(a @ v[:, s])
        x = x + np.concatenate(heads, -1) @ w[p + "attn.c_proj.weight"] + w[p + "attn.c_proj.bias"]
        h = ln(x, w[p + "ln_2.weight"], w[p + "ln_2.bias"])
        x = x + gelu(h @ w[p + "mlp.c_fc.weight"] + w[p + "mlp.c_fc.bias"]) @ w[p + "mlp.c_proj.weight"] + w[p + "mlp.c_proj.bias"]
        resid.append(x)
    unembed = lambda r: ln(r, w["ln_f.weight"], w["ln_f.bias"]) @ w["wte.weight"].T
    return unembed(x[-1]), [int(np.argmax(unembed(r[-1]))) for r in resid], attn_rows


def main():
    w = load(sys.argv[1])
    prompts = json.load(open("tests/fixtures/prompts.json"))
    out = []
    for p in prompts:
        logits, lens, attn = forward(w, p["ids"])
        top = np.argsort(-logits)[:10]
        out.append({
            "text": p["text"],
            "ids": p["ids"],
            "top10": [int(i) for i in top],
            "top10Logits": [round(float(logits[i]), 4) for i in top],
            "lensTop1": lens,
            "attnL5H1": [round(float(v), 5) for v in attn[(5, 1)]],
        })
    json.dump(out, open("tests/fixtures/reference.json", "w"), indent=1)
    print(json.dumps([[o["text"], o["top10"][:3], o["lensTop1"]] for o in out]))


main()
