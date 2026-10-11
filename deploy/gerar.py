"""Gera deploy/docker-compose.yml com o site embutido (base64) para a VPS (projeto Docker "arquitetura").
Uso: python3 deploy/gerar.py   (rodar na raiz do site)"""
import os, base64
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = ['index.html', 'favicon.svg', 'robots.txt']
for d in ['css', 'js', 'fonts', 'img']:
    files += [f'{d}/{f}' for f in sorted(os.listdir(f'{root}/{d}'))]
cfg, tgt = [], []
for i, f in enumerate(files):
    b = base64.b64encode(open(f'{root}/{f}', 'rb').read()).decode()
    lines = '\n'.join('      ' + b[j:j + 76] for j in range(0, len(b), 76))
    cfg.append(f'  f{i:02d}:\n    content: |\n{lines}\n')
    tgt.append(f'      - {{ source: f{i:02d}, target: /in/{f}.b64 }}')
nginx = '''  nginx_conf:
    content: |
      server {
        listen 80;
        root /usr/share/nginx/html;
        index index.html;
        server_tokens off;
        gzip on; gzip_types text/css application/javascript image/svg+xml;
        add_header X-Content-Type-Options nosniff always;
        add_header X-Frame-Options SAMEORIGIN always;
        add_header Referrer-Policy strict-origin-when-cross-origin always;
        location = /index.html { add_header Cache-Control "no-cache" always; add_header X-Content-Type-Options nosniff always; }
        location ~* \\.(css|js)$$ { add_header Cache-Control "public, max-age=604800" always; add_header X-Content-Type-Options nosniff always; }
        location ~* \\.(webp|svg|woff2)$$ { add_header Cache-Control "public, max-age=2592000" always; add_header X-Content-Type-Options nosniff always; }
        location / { try_files $$uri $$uri/ =404; }
        location ~ /\\. { deny all; }
      }
'''
compose = f'''# Site de exemplo "Casa Entardecer" (Arcane Arquitetura). Projeto independente: os arquivos vão embutidos aqui
# (base64) e o serviço "carga" grava no volume a cada deploy. Sem token, sem depender de outro repositório.
services:
  carga:
    image: alpine:3.20
    restart: "no"
    volumes: [site:/site]
    configs:
{chr(10).join(tgt)}
    entrypoint:
      - sh
      - -c
      - |
        set -eu
        rm -rf /site/* /site/.[!.]* 2>/dev/null || true
        cd /in
        find . -name '*.b64' | while read f; do o="/site/$${{f#./}}"; o="$${{o%.b64}}"; mkdir -p "$$(dirname "$$o")"; base64 -d "$$f" > "$$o"; done
        chmod -R a+rX /site
        echo "carga ok: $$(find /site -type f | wc -l) arquivos"
  web:
    image: nginx:alpine
    restart: unless-stopped
    depends_on:
      carga: {{ condition: service_completed_successfully }}
    volumes: [site:/usr/share/nginx/html:ro]
    configs:
      - {{ source: nginx_conf, target: /etc/nginx/conf.d/default.conf }}
    labels:
      - traefik.enable=true
      - traefik.http.routers.arc-arquitetura.rule=Host(`arquitetura.arcanestudios.io`)
      - traefik.http.routers.arc-arquitetura.entrypoints=websecure
      - traefik.http.routers.arc-arquitetura.tls.certresolver=letsencrypt
      - traefik.http.services.arc-arquitetura.loadbalancer.server.port=80

configs:
{nginx}{''.join(cfg)}
volumes:
  site: {{ name: arc_arquitetura }}
'''
open(f'{root}/deploy/docker-compose.yml', 'w').write(compose)
print('ok', len(compose), 'bytes,', len(files), 'arquivos')
