import { kycImageTypes, maxKycImageBytes, maxKycInputBytes, type KycSlot } from "@/lib/kyc";

export async function prepareKycImage(file: File): Promise<File> {
  if (!kycImageTypes.includes(file.type)) throw new Error("Выберите фотографию JPG, PNG или WebP.");
  if (!file.size || file.size > maxKycInputBytes) throw new Error("Размер исходной фотографии — не более 10 МБ.");
  if (file.size <= maxKycImageBytes) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить фотографию.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.94, .86, .78]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= maxKycImageBytes) return new File([blob], "photo.jpg", { type: "image/jpeg" });
    }
    throw new Error("Фотография слишком большая. Выберите чёткий снимок меньшего размера.");
  } catch (error) {
    if (error instanceof DOMException) throw new Error("Не удалось прочитать фотографию. Выберите другой снимок.");
    throw error;
  } finally { URL.revokeObjectURL(url); }
}

export async function kycJsonRequest(path: string, body: object): Promise<Record<string, string>> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  return parseKycResponse(response);
}

async function parseKycResponse(response: Response): Promise<Record<string, string>> {
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Не удалось отправить фотографию. Проверьте соединение и повторите попытку."); }
  if (!response.ok) throw new Error(result.message || "Не удалось отправить фотографию. Повторите попытку.");
  return result;
}

export async function uploadKycPhoto(requestId: string, slot: KycSlot, original: File) {
  const file = await prepareKycImage(original);
  const form = new FormData();
  form.set("requestId", requestId);
  form.set("slot", slot);
  form.set("file", file);
  const response = await fetch("/api/account/kyc/files", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  return parseKycResponse(response);
}
