#!/bin/bash

# 証明書ディレクトリの作成
mkdir -p certs

# 秘密鍵の生成
openssl genrsa -out certs/server.key 2048

# 証明書署名要求（CSR）の生成
openssl req -new -key certs/server.key -out certs/server.csr -subj "/C=JP/ST=Tokyo/L=Tokyo/O=Development/CN=localhost"

# 自己署名証明書の生成
openssl x509 -req -days 365 -in certs/server.csr -signkey certs/server.key -out certs/server.crt

# CSRファイルの削除
rm certs/server.csr

echo "自己署名証明書の生成が完了しました"
echo "証明書は開発目的でのみ使用してください"