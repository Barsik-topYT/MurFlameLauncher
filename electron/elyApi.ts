// elyApi.ts
import { BrowserWindow } from "electron";

const ELY_API = "https://authserver.ely.by/api";
const ELY_SKIN_API = "https://skinsystem.ely.by/api";
const ELY_AUTH_URL = "https://account.ely.by/auth";

const ELY_CLIENT_ID = "murflame-launcher";

export interface ElyProfile {
  id: string;
  username: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface ElyCape {
  id: string;
  name: string;
  url: string;
  owned: boolean;
  current?: boolean;
}

export async function elyGetAuthUrl(port?: number): Promise<string> {
  const state = Math.random().toString(36).substring(2, 15);
  const redirectUri = port ? `http://localhost:${port}/auth` : `http://localhost:24567/auth`;
  return `${ELY_AUTH_URL}/authorize?response_type=code&client_id=${ELY_CLIENT_ID}&redirect_uri=${redirectUri}&scope=openid%20profile%20email%20offline&state=${state}`;
}

export async function elyExchangeCode(code: string): Promise<ElyProfile> {
  const response = await fetch(`${ELY_API}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: ELY_CLIENT_ID,
      redirect_uri: "http://localhost:24567/auth"
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || "Ошибка обмена кода");
  }
  
  const data = await response.json();
  
  const userResponse = await fetch(`${ELY_API}/user/profile`, {
    headers: { "Authorization": `Bearer ${data.access_token}` }
  });
  
  if (!userResponse.ok) throw new Error("Ошибка получения профиля");
  
  const user = await userResponse.json();
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000
  };
}

export async function elyRefreshToken(refreshToken: string): Promise<ElyProfile> {
  const response = await fetch(`${ELY_API}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ELY_CLIENT_ID
    })
  });
  
  if (!response.ok) throw new Error("Ошибка обновления токена ely.by");
  
  const data = await response.json();
  
  const userResponse = await fetch(`${ELY_API}/user/profile`, {
    headers: { "Authorization": `Bearer ${data.access_token}` }
  });
  
  if (!userResponse.ok) throw new Error("Ошибка получения профиля");
  
  const user = await userResponse.json();
  
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000
  };
}

export async function elyGetProfile(accessToken: string): Promise<ElyProfile> {
  const response = await fetch(`${ELY_API}/user/profile`, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  
  if (!response.ok) throw new Error("Ошибка получения профиля ely.by");
  
  const data = await response.json();
  return {
    id: data.id,
    username: data.username,
    accessToken
  };
}

export async function elyChangeSkin(accessToken: string, filePath: string, model: "classic" | "slim"): Promise<void> {
  const fileBuffer = await fetch(`file://${filePath}`).then(r => r.arrayBuffer());
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), "skin.png");
  formData.append("model", model === "slim" ? "slim" : "default");
  
  const response = await fetch(`${ELY_SKIN_API}/skins`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` },
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ошибка загрузки скина: ${error}`);
  }
}

export async function elyResetSkin(accessToken: string): Promise<void> {
  const response = await fetch(`${ELY_SKIN_API}/skins`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  
  if (!response.ok) throw new Error("Ошибка сброса скина");
}

export async function elyChangeCape(accessToken: string, filePath: string): Promise<void> {
  const fileBuffer = await fetch(`file://${filePath}`).then(r => r.arrayBuffer());
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), "cape.png");
  
  const response = await fetch(`${ELY_SKIN_API}/capes`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` },
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ошибка загрузки плаща: ${error}`);
  }
}

export async function elyResetCape(accessToken: string): Promise<void> {
  const response = await fetch(`${ELY_SKIN_API}/capes`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  
  if (!response.ok) throw new Error("Ошибка сброса плаща");
}

export async function elyGetSkinUrl(uuid: string): Promise<string> {
  return `https://skinsystem.ely.by/textures/skin/${uuid}`;
}

export async function elyGetCapeUrl(uuid: string): Promise<string | null> {
  try {
    const response = await fetch(`${ELY_SKIN_API}/capes/${uuid}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.url || null;
  } catch {
    return null;
  }
}

export async function elyGetCapesList(accessToken: string): Promise<ElyCape[]> {
  try {
    const response = await fetch(`${ELY_SKIN_API}/capes/list`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    
    if (!response.ok) return [];
    
    const capes = await response.json();
    
    const currentResponse = await fetch(`${ELY_SKIN_API}/capes/current`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    
    let currentCapeId: string | null = null;
    if (currentResponse.ok) {
      const current = await currentResponse.json();
      currentCapeId = current.id;
    }
    
    return capes.map((cape: any) => ({
      id: cape.id,
      name: cape.name,
      url: cape.url,
      owned: true,
      current: cape.id === currentCapeId
    }));
  } catch (e) {
    console.warn("Failed to get capes list:", e);
    return [];
  }
}

export async function elyEquipCape(accessToken: string, capeId: string): Promise<void> {
  const response = await fetch(`${ELY_SKIN_API}/capes/equip/${capeId}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  
  if (!response.ok) throw new Error("Не удалось установить плащ");
}