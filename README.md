# arquitetura.arcanestudios.io

Site de demonstração "Casa Entardecer" (Arcane Arquitetura): passeio animado pela casa, no PC comandado pela rolagem. Projeto conceitual da Arcane Studios; imagens geradas por IA.

- Fonte estática (HTML/CSS/JS, sem build).
- Hospedagem: VPS (projeto Docker `arquitetura`, Traefik, domínio `arquitetura.arcanestudios.io`). `deploy/gerar.py` gera `deploy/docker-compose.yml` com o site embutido.
- Modo gravação de vídeo: `?gravar`.
