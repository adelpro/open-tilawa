# apps/web — reserved for future frontend migration

The live frontend currently lives at https://tilawa.quran.us.kg (external).
When migrating locally, place the PWA here (Next.js/Vite) with its own Dockerfile,
mirroring uslub/apps/web. The edge (nginx) already routes `/` to the web service
once added to docker-compose.yml.
