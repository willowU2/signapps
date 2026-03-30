import glob
import re
import os

count = 0
files_modified = 0

for f in sorted(glob.glob('services/*/src/handlers/*.rs')):
    # Normalize path separators for cross-platform compatibility
    f_norm = f.replace('\\', '/')
    parts = f_norm.split('/')
    svc = parts[1].replace('signapps-', '')
    tag = svc.replace('-', ' ').title().replace(' ', '')
    handler_file = os.path.basename(f).replace('.rs', '')

    if handler_file == 'mod':
        continue

    with open(f, 'r', encoding='utf-8') as fh:
        lines = fh.readlines()

    result = []
    i = 0
    modified = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Check if this is a pub async fn WITHOUT utoipa::path above it
        if stripped.startswith('pub async fn '):
            # Look back for utoipa::path
            has_utoipa = False
            j = len(result) - 1
            while j >= 0:
                prev = result[j].strip()
                if 'utoipa::path' in prev:
                    has_utoipa = True
                    break
                elif prev.startswith('#[') or prev.startswith('///') or prev.startswith('//') or prev == '':
                    j -= 1
                else:
                    break

            if not has_utoipa:
                # Parse function
                fn_match = re.match(r'pub async fn (\w+)', stripped)
                if fn_match:
                    fn_name = fn_match.group(1)

                    # Look ahead for full signature (may span multiple lines)
                    sig_lines = stripped
                    k = i + 1
                    while k < len(lines) and ('{' not in sig_lines or sig_lines.count('{') < sig_lines.count('}')):
                        # Just collect until we find the closing paren of the args
                        if ')' in sig_lines:
                            break
                        sig_lines += ' ' + lines[k].strip()
                        k += 1

                    # Infer method
                    method = 'get'
                    for prefix, m in [
                        ('create_', 'post'), ('add_', 'post'), ('submit_', 'post'),
                        ('import_', 'post'), ('generate_', 'post'), ('run_', 'post'),
                        ('validate_', 'post'), ('send_', 'post'), ('export_', 'post'),
                        ('delegate_', 'post'), ('upload_', 'post'), ('bulk_create', 'post'),
                        ('bulk_delete', 'delete'),
                        ('update_', 'put'), ('edit_', 'put'), ('approve_', 'put'),
                        ('reject_', 'put'), ('save_', 'put'), ('set_', 'put'),
                        ('toggle_', 'put'), ('mark_', 'put'), ('assign_', 'put'),
                        ('revoke_', 'put'), ('enable_', 'put'), ('disable_', 'put'),
                        ('reset_', 'put'), ('refresh_', 'put'), ('renew_', 'put'),
                        ('complete_', 'put'), ('cancel_', 'put'), ('archive_', 'put'),
                        ('restore_', 'put'), ('transfer_', 'put'), ('move_', 'put'),
                        ('copy_', 'post'), ('clone_', 'post'), ('duplicate_', 'post'),
                        ('publish_', 'put'), ('unpublish_', 'put'),
                        ('delete_', 'delete'), ('remove_', 'delete'), ('purge_', 'delete'),
                    ]:
                        if fn_name.startswith(prefix):
                            method = m
                            break

                    # Has path param? Check for Path( in signature
                    has_path = bool(re.search(r'Path\s*\(', sig_lines))

                    # Detect what path parameter name might be
                    path_param = 'id'
                    path_match = re.search(r'Path\s*\((\w+)\)', sig_lines)
                    if path_match:
                        path_param = path_match.group(1)
                    elif re.search(r'Path\s*\(\(', sig_lines):
                        # tuple destructuring like Path((id, other_id))
                        has_path = True
                        path_param = 'id'

                    # Build path
                    path = f'/api/v1/{handler_file}'
                    if has_path:
                        path += f'/{{{path_param}}}'

                    # Status code
                    status = '200'
                    if method == 'post':
                        status = '201'
                    elif method == 'delete':
                        status = '204'

                    indent = len(line) - len(line.lstrip())
                    prefix_space = ' ' * indent

                    annotation = (
                        f'{prefix_space}#[utoipa::path(\n'
                        f'{prefix_space}    {method},\n'
                        f'{prefix_space}    path = "{path}",\n'
                        f'{prefix_space}    responses((status = {status}, description = "Success")),\n'
                        f'{prefix_space}    tag = "{tag}"\n'
                        f'{prefix_space})]\n'
                    )
                    result.append(annotation)
                    count += 1
                    modified = True

        result.append(line)
        i += 1

    if modified:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.writelines(result)
        files_modified += 1
        print(f'  Modified: {f}')

print(f'\nAdded utoipa::path to {count} handlers across {files_modified} files')
