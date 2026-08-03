"""
collect_files.py
────────────────
Scans the target folders relative to the script directory,
collects file contents for the selected extensions and writes them
into a single .txt file next to the script.

Configuration is in the CONFIGURATION block below.
"""

from __future__ import annotations

import os
import re
import sys
import json
import traceback
from datetime import datetime
from typing import Optional

# ══════════════════════════════════════════════════════════
#  CONFIGURATION  —  edit only this block
# ══════════════════════════════════════════════════════════

TARGET_FOLDERS: list[str] = [
#    "Merge2/unity/Packages/com.bitgames.m2",
#    "Merge2/meta/m2",
#    "Merge2/unity/Assets/Scripts/Game/M2"
    "stock-analyzer"
]

TARGET_EXTENSIONS: tuple[str, ...] = (".cs", ".mtgn", ".js", ".bat", ".md", ".asmdef", ".bhl", ".txt", ".json", ".html", ".tsx", ".css", ".ts")

IGNORE_SUBSTRINGS: list[str] = []

SIGNATURE_SUBSTRINGS: list[str] = []

OUTPUT_FILENAME: str = "collected_files.txt"
SOURCE_ENCODING: str = "utf-8"

GROUPS_FILENAME: str = "collected_files_groups.js"
PREFIX_FILENAME: str = "collected_files_prefix.txt"

# ══════════════════════════════════════════════════════════


ACCESS_RE = re.compile(
    r"^(?:\[[^\]]*\]\s*)*(?:public|protected|internal|protected\s+internal|internal\s+protected)\b",
    re.IGNORECASE,
)
TYPE_DECL_RE = re.compile(
    r"^(?:\[[^\]]*\]\s*)*"
    r"(?:(?:public|protected|internal|private|file)\s+)?"
    r"(?:static\s+|abstract\s+|sealed\s+|partial\s+|readonly\s+|unsafe\s+|new\s+)*"
    r"(class|struct|interface|record|enum)\b",
    re.IGNORECASE,
)
NAMESPACE_RE = re.compile(
    r"^(?:\[[^\]]*\]\s*)*namespace\s+([A-Za-z_][\w.]*)(\s*;|\s*\{)?$",
    re.IGNORECASE,
)
ENUM_MEMBER_RE = re.compile(r"^(?:[A-Za-z_][\w]*)(?:\s*\([^{};]*\))?(?:\s*=\s*[^,{}]+)?\s*,?$")
CONTROL_RE = re.compile(
    r"^(?:if|else|for|foreach|while|switch|case|default|try|catch|finally|do|lock|using)\b",
    re.IGNORECASE,
)


def path_contains_any(path: str, substrings: list[str]) -> bool:
    path_normalized = path.replace("\\", "/").lower()
    return any(sub.lower() in path_normalized for sub in substrings)


def should_ignore(rel_path: str, ignore_substrings: list[str]) -> bool:
    return path_contains_any(rel_path, ignore_substrings)


def should_use_signature_mode(rel_path: str, signature_substrings: list[str]) -> bool:
    return path_contains_any(rel_path, signature_substrings)


def strip_comments_preserve_lines(text: str) -> str:
    """Удаляет комментарии, сохраняя переводы строк."""
    result: list[str] = []
    i = 0
    in_block = False
    in_line = False
    in_string = False
    in_verbatim_string = False

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if in_line:
            if ch == "\n":
                in_line = False
                result.append(ch)
            i += 1
            continue

        if in_block:
            if ch == "*" and nxt == "/":
                in_block = False
                i += 2
                continue
            if ch == "\n":
                result.append(ch)
            i += 1
            continue

        if in_string:
            result.append(ch)
            if in_verbatim_string:
                if ch == '"' and nxt == '"':
                    result.append(nxt)
                    i += 2
                    continue
                if ch == '"':
                    in_string = False
                    in_verbatim_string = False
            else:
                if ch == "\\" and nxt:
                    result.append(nxt)
                    i += 2
                    continue
                if ch == '"':
                    in_string = False
            i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block = True
            i += 2
            continue

        if ch == "@" and nxt == '"':
            in_string = True
            in_verbatim_string = True
            result.append(ch)
            result.append(nxt)
            i += 2
            continue

        if ch == '"':
            in_string = True
            in_verbatim_string = False
            result.append(ch)
            i += 1
            continue

        result.append(ch)
        i += 1

    return "".join(result)


def collapse_statement(parts: list[str]) -> str:
    return " ".join(part.strip() for part in parts if part.strip()).strip()


def is_file_scoped_namespace(statement: str) -> bool:
    return bool(NAMESPACE_RE.match(statement)) and statement.rstrip().endswith(";")


def normalize_namespace(statement: str) -> str:
    match = NAMESPACE_RE.match(statement)
    if not match:
        return statement.strip()
    return f"namespace {match.group(1)}"


def is_type_declaration(statement: str) -> bool:
    return bool(TYPE_DECL_RE.match(statement))


def normalize_type_declaration(statement: str) -> str:
    text = statement.strip()
    text = re.sub(r"\s*\{\s*$", "", text).strip()
    text = re.sub(r"\s*where\s+.*$", "", text).strip()
    return text


def is_enum_member(statement: str) -> bool:
    text = statement.strip().rstrip(",").strip()
    if not text:
        return False
    if text.startswith("["):
        return False
    if any(word in text for word in ("{", "}", ";", "=>")):
        return False
    return bool(ENUM_MEMBER_RE.match(text))


def is_non_private_member(statement: str) -> bool:
    text = statement.strip()
    if not ACCESS_RE.match(text):
        return False
    if CONTROL_RE.match(text):
        return False
    if re.search(r"\b(class|struct|interface|enum)\b", text, re.IGNORECASE):
        return False
    return True


def normalize_member(statement: str) -> str:
    text = statement.strip()
    text = re.sub(r"\s*\{\s*$", "", text).strip()
    return text


def extract_csharp_signatures(content: str) -> str:
    cleaned = strip_comments_preserve_lines(content)
    lines = cleaned.splitlines()

    output: list[str] = []
    pending_parts: list[str] = []
    structural_stack: list[dict[str, int | str]] = []
    depth = 0

    def current_structural_block() -> dict[str, int | str] | None:
        for block in reversed(structural_stack):
            if block["kind"] in {"namespace", "type", "enum"}:
                return block
        return None

    def current_structural_depth() -> int:
        return sum(1 for block in structural_stack if block["kind"] in {"namespace", "type", "enum"})

    def update_depth(statement: str) -> None:
        nonlocal depth
        depth += statement.count("{") - statement.count("}")
        while structural_stack and depth <= int(structural_stack[-1]["open_depth"]):
            structural_stack.pop()

    def finalize_statement(parts: list[str]) -> None:
        statement = collapse_statement(parts)
        if not statement:
            return

        if statement.startswith("#"):
            update_depth(statement)
            return

        if statement.startswith("using ") and not structural_stack:
            output.append(statement.rstrip(";"))
            update_depth(statement)
            return

        namespace_match = NAMESPACE_RE.match(statement)
        if namespace_match:
            output.append(normalize_namespace(statement))
            if statement.rstrip().endswith("{"):
                structural_stack.append({"kind": "namespace", "open_depth": depth})
            update_depth(statement)
            return

        if is_type_declaration(statement):
            output.append(normalize_type_declaration(statement))
            if statement.rstrip().endswith("{"):
                kind = "enum" if re.search(r"\benum\b", statement, re.IGNORECASE) else "type"
                structural_stack.append({"kind": kind, "open_depth": depth})
            update_depth(statement)
            return

        current_block = current_structural_block()
        structural_depth = current_structural_depth()

        if current_block and current_block["kind"] == "enum":
            if depth == int(current_block["open_depth"]) + 1 and is_enum_member(statement):
                output.append("    " * structural_depth + statement.rstrip())
        elif current_block and current_block["kind"] == "type":
            if depth == int(current_block["open_depth"]) + 1 and is_non_private_member(statement):
                output.append("    " * structural_depth + normalize_member(statement))

        update_depth(statement)

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        pending_parts.append(stripped)
        current_block = None
        for block in reversed(structural_stack):
            if block["kind"] in {"namespace", "type", "enum"}:
                current_block = block
                break

        if current_block and current_block["kind"] == "enum" and stripped.endswith(","):
            finalize_statement(pending_parts)
            pending_parts = []
            continue

        if stripped.endswith(("{", ";", "}", "=>")) or stripped.endswith("]"):
            finalize_statement(pending_parts)
            pending_parts = []

    if pending_parts:
        finalize_statement(pending_parts)

    return "\n".join(output)


def load_groups(base_dir: str) -> list[dict]:
    """
    Загружает группы из файла .js, парсит JSON и возвращает список правил:
    [{"path": str, "status": str, "is_dir": bool}, ...]
    Порядок правил сохраняется для обеспечения приоритета верхней группы.
    """
    groups_path = os.path.join(base_dir, GROUPS_FILENAME)
    if not os.path.exists(groups_path):
        return []

    with open(groups_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Очищаем от комментариев для безопасного парсинга JSON
    content = strip_comments_preserve_lines(content)

    # Ищем начало и конец JSON (массив или объект)
    start_match = re.search(r'[[{]', content)
    if not start_match:
        print(f"[WARN] Failed to find JSON structure in {GROUPS_FILENAME}")
        return []
    
    start_idx = start_match.start()
    end_char = ']' if start_match.group() == '[' else '}'
    end_idx = content.rfind(end_char)

    if end_idx == -1 or end_idx < start_idx:
        print(f"[WARN] Invalid JSON structure in {GROUPS_FILENAME}")
        return []

    json_str = content[start_idx:end_idx + 1]

    try:
        groups_data = json.loads(json_str)
    except Exception as e:
        print(f"[WARN] Failed to parse JSON from {GROUPS_FILENAME}: {e}")
        print("Make sure keys and string values use double quotes (\").")
        return []

    if not isinstance(groups_data, list):
        groups_data = [groups_data]

    rules = []
    for group in groups_data:
        status = group.get("status", "full").lower()
        files = group.get("files", [])
        for file_path in files:
            norm_path = file_path.replace("\\", "/")
            full_path = os.path.join(base_dir, norm_path)
            
            # Определяем, является ли путь папкой
            is_dir = norm_path.endswith("/") or os.path.isdir(full_path)
            
            # Если это папка, убеждаемся, что она заканчивается на слеш для корректного поиска префикса
            if is_dir and not norm_path.endswith("/"):
                norm_path += "/"
                
            rules.append({
                "path": norm_path,
                "status": status,
                "is_dir": is_dir
            })

    return rules


def get_file_status(rel_path: str, group_rules: list[dict]) -> Optional[str]:
    """
    Определяет статус файла, проверяя его на соответствие правилам из групп.
    Возвращает первый найденный статус (правила идут в порядке приоритета).
    """
    for rule in group_rules:
        if rule["is_dir"]:
            if rel_path.startswith(rule["path"]):
                return rule["status"]
        else:
            if rel_path == rule["path"]:
                return rule["status"]
    return None


def load_prefix(base_dir: str) -> str:
    """Загружает текст из файла префикса, если он существует."""
    prefix_path = os.path.join(base_dir, PREFIX_FILENAME)
    if not os.path.exists(prefix_path):
        return ""
    
    try:
        with open(prefix_path, "r", encoding="utf-8") as f:
            content = f.read()
            if content and not content.endswith("\n"):
                content += "\n"
            return content
    except Exception as e:
        print(f"[WARN] Failed to read {PREFIX_FILENAME}: {e}")
        return ""


def collect_files(
    base_dir: str,
    target_folders: list[str],
    extensions: tuple[str, ...],
    ignore_substrings: list[str],
    signature_substrings: list[str],
    group_rules: list[dict]
) -> list[tuple[str, Optional[str], str]]:
    
    results: list[tuple[str, Optional[str], str]] = []
    all_files_to_process = set()

    # 1. Добавляем файлы и содержимое папок, указанных в группах
    for rule in group_rules:
        if not rule["is_dir"]:
            # Конкретный файл берём всегда, игнорируя фильтр по расширению
            all_files_to_process.add(rule["path"])
        else:
            # Для папок сканируем их и берём только подходящие по расширению файлы
            folder_path = os.path.join(base_dir, rule["path"])
            if os.path.isdir(folder_path):
                for root, _, files in os.walk(folder_path):
                    for filename in files:
                        if filename.lower().endswith(extensions):
                            file_path = os.path.join(root, filename)
                            rel_path = os.path.relpath(file_path, base_dir).replace("\\", "/")
                            all_files_to_process.add(rel_path)

    # 2. Сканируем стандартные целевые папки
    for folder in target_folders:
        folder_path = os.path.join(base_dir, folder)
        if not os.path.isdir(folder_path):
            print(f"[WARN] Target folder not found, skipping: {folder_path}")
            continue

        print(f"[INFO] Scanning: {folder_path}")
        for root, _, files in os.walk(folder_path):
            for filename in files:
                if not filename.lower().endswith(extensions):
                    continue
                file_path = os.path.join(root, filename)
                rel_path = os.path.relpath(file_path, base_dir).replace("\\", "/")
                all_files_to_process.add(rel_path)

    # Обрабатываем все собранные пути по алфавиту
    for rel_path in sorted(list(all_files_to_process)):
        # Определяем статус: сначала ищем совпадение в группах
        status = get_file_status(rel_path, group_rules)
        
        # Если в группах не найдено, применяем стандартные фильтры из кода
        if status is None:
            if should_ignore(rel_path, ignore_substrings):
                status = "hide"
            elif should_use_signature_mode(rel_path, signature_substrings):
                status = "signature"
            else:
                status = "full"
        
        if status == "ignore":
            continue

        full_path = os.path.join(base_dir, rel_path)
        if not os.path.isfile(full_path):
            # Может случиться, если указали несуществующий файл в правилах
            print(f"  [MISSING] {rel_path} (referenced in groups but not found)")
            continue

        try:
            with open(full_path, "r", encoding=SOURCE_ENCODING, errors="replace") as fh:
                content = fh.read()

            if status == "hide":
                print(f"  [HIDE] {rel_path}")
                results.append((rel_path, None, "hide"))
            
            elif status == "signature":
                print(f"  [SIG]  {rel_path}")
                if rel_path.lower().endswith(".cs"):
                    sig_content = extract_csharp_signatures(content).strip()
                    if sig_content:
                        sig_content += "\n"
                else:
                    sig_content = content if content.endswith("\n") else content + "\n"
                results.append((rel_path, sig_content, "signature"))
            
            else: # status == "full"
                print(f"  [OK]   {rel_path}")
                rendered = content if content.endswith("\n") else content + "\n"
                results.append((rel_path, rendered, "full"))

        except Exception as exc:
            print(f"  [ERR]  {rel_path} - {exc}")

    return results


def write_output(
    output_path: str,
    files: list[tuple[str, Optional[str], str]],
    target_folders: list[str],
    extensions: tuple[str, ...],
    ignore_substrings: list[str],
    signature_substrings: list[str],
    prefix_content: str
) -> None:
    sep_major = "=" * 3
    sep_minor = "-" * 3

    with open(output_path, "w", encoding="utf-8") as out:
        # Вставляем префиксный текст из отдельного файла, если он есть
        if prefix_content:
            out.write(f"{sep_major}\n")
            out.write(prefix_content)
            out.write(f"{sep_major}\n\n")

        out.write(f"{sep_major}\n")
        out.write("COLLECTED FILES REPORT\n")
        out.write(f"Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"Folders: {', '.join(target_folders)}\n")
        out.write(f"Extensions: {', '.join(extensions)}\n")
        if ignore_substrings:
            out.write(f"Ignore substrings: {', '.join(ignore_substrings)}\n")
        if signature_substrings:
            out.write(f"Signature substrings: {', '.join(signature_substrings)}\n")
        out.write(f"Files: {len(files)}\n")
        out.write(f"{sep_major}\n\n")

        out.write("CONTENTS\n")
        out.write(f"{sep_minor}\n")
        for idx, (rel_path, content, status) in enumerate(files, 1):
            if status == "signature":
                status_str = " [CONTENT REPLACED WITH SIGNATURES]"
            elif status == "hide":
                status_str = " [CONTENT HIDDEN]"
            else:
                status_str = ""
            out.write(f"{idx:>4}. {rel_path}{status_str}\n")
        out.write(f"\n{sep_major}\n\n")

        for idx, (rel_path, content, status) in enumerate(files, 1):
            if status == "hide" or content is None:
                print(f"FILE {idx}/{len(files)} | {rel_path} | <CONTENT EXCLUDED BY FILTER>")
                # out.write("<CONTENT EXCLUDED BY FILTER>\n")
            else:
                out.write(f"FILE {idx}/{len(files)}\n")
                out.write(f"PATH: {rel_path}\n")
                out.write(f"{sep_minor}\n")
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")

                out.write(f"\n{sep_major}\n\n")

def main() -> None:
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    output_path = os.path.join(base_dir, OUTPUT_FILENAME)

    print(f"\n{'=' * 60}")
    print("collect_files.py")
    print(f"Base directory : {base_dir}")
    print(f"Output file    : {output_path}")
    print(f"{'=' * 60}\n")

    # Получаем список правил из групп
    group_rules = load_groups(base_dir)
    
    # Загружаем префикс, если есть
    prefix_content = load_prefix(base_dir)

    files = collect_files(
        base_dir,
        TARGET_FOLDERS,
        TARGET_EXTENSIONS,
        IGNORE_SUBSTRINGS,
        SIGNATURE_SUBSTRINGS,
        group_rules
    )

    if not files:
        print("\n[WARN] No matching files were found. Output file was not created.")
        return

    write_output(
        output_path,
        files,
        TARGET_FOLDERS,
        TARGET_EXTENSIONS,
        IGNORE_SUBSTRINGS,
        SIGNATURE_SUBSTRINGS,
        prefix_content
    )

    print(f"\n[DONE] Processed files: {len(files)}")
    print(f"[DONE] Result written to: {output_path}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("\n[ERROR] The script failed with an unexpected exception.\n")
        traceback.print_exc()
        try:
            if sys.stdin and sys.stdin.isatty():
                input("\nPress Enter to close...")
        except Exception:
            pass
        raise