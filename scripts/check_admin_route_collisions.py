import re, glob, collections, sys

seen = collections.defaultdict(list)
for f in sorted(glob.glob('services/admin/routes/*.py')):
    if f.endswith('__init__.py'):
        continue
    txt = open(f, encoding='utf-8').read()
    for m in re.finditer(r"""@router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']""", txt):
        seen[(m.group(1).upper(), m.group(2))].append(f.replace('\\', '/'))

dupes = {k: v for k, v in seen.items() if len(v) > 1}
if not dupes:
    print(f'OK: no path collisions across {len(seen)} admin routes.')
    sys.exit(0)
print(f'FOUND {len(dupes)} colliding routes:')
for (mtd, path), files in sorted(dupes.items()):
    print(f'  {mtd:6} {path}')
    for x in files:
        print('       ->', x)
sys.exit(1)
