import type { Context } from "hono";
import { getSettings, resetLogo, updateLogo } from "../services/settings.service";
import { handleError } from "../lib/errors";

export async function getSettingsController(c: Context) {
  const settings = await getSettings();
  return c.json(settings, 200);
}

export async function updateLogoController(c: Context) {
  const body = await c.req.parseBody().catch(() => null);
  const file = body?.logo;

  if (!(file instanceof File)) {
    return c.json({ message: "File logo wajib diupload dengan field name 'logo'" }, 400);
  }

  try {
    const settings = await updateLogo(file);
    return c.json(settings, 200);
  } catch (err) {
    return handleError(c, err);
  }
}

export async function resetLogoController(c: Context) {
  try {
    const settings = await resetLogo();
    return c.json(settings, 200);
  } catch (err) {
    return handleError(c, err);
  }
}
