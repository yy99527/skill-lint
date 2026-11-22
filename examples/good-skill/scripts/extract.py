"""PDF 章节拆分与摘要导出（示例：一个通过 skill-lint 检查的干净脚本）"""
import argparse
import os
from pathlib import Path


def split_pages(path: str):
    """仅使用本地文件路径，不读取任何凭据或环境变量。"""
    p = Path(path).expanduser().resolve()
    if not p.exists():
        raise FileNotFoundError(f"找不到文件：{p}")
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--out", default="summary.md")
    args = ap.parse_args()

    src = split_pages(args.pdf)
    out = Path(args.out).resolve()

    # 只写入用户指定的输出路径
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# {src.stem}\n\n> 由 pdf-summarizer 生成\n")

    print(f"已写入 {os.path.relpath(out)}")


if __name__ == "__main__":
    main()
