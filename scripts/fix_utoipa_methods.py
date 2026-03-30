"""
Fix utoipa::path annotations where the inferred HTTP method is wrong
because the function has a bare verb name (e.g., `create`, `update`, `delete`)
without an underscore suffix.
"""
import glob
import re
import os

EXACT_METHOD_MAP = {
    'create': 'post',
    'add': 'post',
    'submit': 'post',
    'import': 'post',
    'generate': 'post',
    'run': 'post',
    'validate': 'post',
    'send': 'post',
    'export': 'post',
    'delegate': 'post',
    'upload': 'post',
    'update': 'put',
    'edit': 'put',
    'approve': 'put',
    'reject': 'put',
    'save': 'put',
    'toggle': 'put',
    'mark': 'put',
    'assign': 'put',
    'revoke': 'put',
    'enable': 'put',
    'disable': 'put',
    'reset': 'put',
    'refresh': 'put',
    'renew': 'put',
    'complete': 'put',
    'cancel': 'put',
    'archive': 'put',
    'restore': 'put',
    'transfer': 'put',
    'move': 'put',
    'publish': 'put',
    'unpublish': 'put',
    'delete': 'delete',
    'remove': 'delete',
    'purge': 'delete',
}

STATUS_FOR_METHOD = {
    'post': '201',
    'put': '200',
    'delete': '204',
    'get': '200',
}

count = 0
files_modified = 0

for f in sorted(glob.glob('services/*/src/handlers/*.rs')):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()

    # Pattern: find utoipa::path block followed (possibly after other attrs) by pub async fn
    # We'll work line by line
    lines = content.splitlines(keepends=True)
    result = []
    i = 0
    modified = False

    while i < len(lines):
        line = lines[i]

        # Detect start of utoipa::path block
        if '#[utoipa::path(' in line.strip():
            # Collect the full annotation block
            annotation_start = i
            annotation_lines = [line]
            i += 1
            depth = line.count('(') - line.count(')')
            while i < len(lines) and depth > 0:
                annotation_lines.append(lines[i])
                depth += lines[i].count('(') - lines[i].count(')')
                i += 1

            # Now skip any other attrs/doc comments to find the pub async fn
            j = i
            intervening = []
            while j < len(lines):
                s = lines[j].strip()
                if s.startswith('pub async fn '):
                    break
                elif s.startswith('#[') or s.startswith('///') or s.startswith('//') or s == '':
                    intervening.append(lines[j])
                    j += 1
                else:
                    j = len(lines)  # not found
                    break

            if j < len(lines):
                fn_line = lines[j].strip()
                fn_match = re.match(r'pub async fn (\w+)', fn_line)
                if fn_match:
                    fn_name = fn_match.group(1)

                    # Determine correct method based on exact name match
                    correct_method = None
                    for exact_name, method in EXACT_METHOD_MAP.items():
                        if fn_name == exact_name:
                            correct_method = method
                            break

                    if correct_method:
                        # Find current method in annotation
                        ann_text = ''.join(annotation_lines)
                        # Match the method line: e.g., "    get," or "    post,"
                        method_match = re.search(r'(#\[utoipa::path\(\s*\n\s*)(\w+)(,)', ann_text)
                        if method_match:
                            current_method = method_match.group(2)
                            if current_method != correct_method:
                                # Fix method
                                old_ann = ann_text
                                new_ann = re.sub(
                                    r'(#\[utoipa::path\(\s*\n\s*)(\w+)(,)',
                                    lambda m: m.group(1) + correct_method + m.group(3),
                                    ann_text,
                                    count=1
                                )
                                # Fix status code
                                correct_status = STATUS_FOR_METHOD[correct_method]
                                new_ann = re.sub(
                                    r'status = \d+',
                                    f'status = {correct_status}',
                                    new_ann,
                                    count=1
                                )
                                if new_ann != old_ann:
                                    annotation_lines = new_ann.splitlines(keepends=True)
                                    count += 1
                                    modified = True

            result.extend(annotation_lines)
            result.extend(intervening)
            # i is already past the annotation block; j points to pub async fn
            # Continue from j onward
            i = j
            continue

        result.append(line)
        i += 1

    if modified:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.writelines(result)
        files_modified += 1
        print(f'  Fixed: {f}')

print(f'\nFixed {count} method annotations across {files_modified} files')
