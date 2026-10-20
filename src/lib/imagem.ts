/**
 * Reduz a foto de perfil antes de enviar (lado maior de 512px, JPEG).
 * Economiza dados no celular e remove metadados (EXIF) da imagem.
 * Só roda no navegador.
 */
export async function reduzirImagem(arquivo: File, lado = 512): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Canvas indisponível.");

  // fundo branco: PNG transparente não pode virar fundo preto no JPEG
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(imagem, 0, 0, largura, altura);
  imagem.close();

  return new Promise((resolver, rejeitar) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolver(blob) : rejeitar(new Error("Falha ao converter.")),
      "image/jpeg",
      0.85,
    );
  });
}
