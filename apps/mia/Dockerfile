FROM node:20-alpine
RUN apk add --no-cache poppler-utils python3 py3-pip libreoffice font-noto font-noto-cjk     && pip3 install --no-cache-dir pymupdf python-docx --break-system-packages
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
COPY translate_cv.py .
COPY translate_cv_docx.py .
EXPOSE 3100
CMD ["node", "server.js"]
