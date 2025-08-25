# SSL Certificates Directory

Place your SSL certificates in this directory with the following names:

- `fullchain.pem` - Full certificate chain (certificate + intermediate certificates)
- `privkey.pem` - Private key for the certificate

## For Let's Encrypt users:
If you're using Let's Encrypt/Certbot, you can copy or symlink the files:

```bash
# Copy from Let's Encrypt
cp /etc/letsencrypt/live/fancai.ru/fullchain.pem ./fullchain.pem
cp /etc/letsencrypt/live/fancai.ru/privkey.pem ./privkey.pem

# Or create symlinks
ln -s /etc/letsencrypt/live/fancai.ru/fullchain.pem ./fullchain.pem
ln -s /etc/letsencrypt/live/fancai.ru/privkey.pem ./privkey.pem
```

## For self-signed certificates (development only):
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem \
  -out fullchain.pem \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=Dev/CN=fancai.ru"
```

## Important:
- Set proper permissions: `chmod 600 *.pem`
- Never commit real certificates to Git
- Add `*.pem` to .gitignore