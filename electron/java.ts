import { existsSync, mkdirSync, readdirSync, unlinkSync, rmSync, statSync } from "fs";
import { join } from "path";
import { downloadFile } from "./utils.js";
import AdmZip from "adm-zip";
import fsExtra from "fs-extra";
const { copySync, removeSync } = fsExtra;

const JAVA_DOWNLOADS = {
  win32: {
    x64: {
      java8: "https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u412-b08/OpenJDK8U-jre_x64_windows_hotspot_8u412b08.zip",
      java17: "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jre_x64_windows_hotspot_17.0.11_9.zip",
      java21: "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jre_x64_windows_hotspot_21.0.3_9.zip",
    },
  },
  darwin: {
    x64: {
      java8: "https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u412-b08/OpenJDK8U-jre_x64_mac_hotspot_8u412b08.tar.gz",
      java17: "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jre_x64_mac_hotspot_17.0.11_9.tar.gz",
      java21: "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jre_x64_mac_hotspot_21.0.3_9.tar.gz",
    },
  },
  linux: {
    x64: {
      java8: "https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u412-b08/OpenJDK8U-jre_x64_linux_hotspot_8u412b08.tar.gz",
      java17: "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jre_x64_linux_hotspot_17.0.11_9.tar.gz",
      java21: "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.3%2B9/OpenJDK21U-jre_x64_linux_hotspot_21.0.3_9.tar.gz",
    },
  },
} as const;

export type JavaVersion = "java8" | "java17" | "java21";

function getPlatformKey(): keyof typeof JAVA_DOWNLOADS {
  if (process.platform === "win32") return "win32";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

export function getJavaRuntimePath(version: JavaVersion, baseDir: string): string {
  const platform = getPlatformKey();
  const arch = "x64"; // Only x64 supported for now
  
  const javaDir = join(baseDir, "java", version, platform, arch);
  const javaExe = join(javaDir, "bin", process.platform === "win32" ? "java.exe" : "java");

  if (existsSync(javaExe)) {
    return javaExe;
  }

  return "";
}

async function extractTarGz(tarPath: string, destDir: string): Promise<void> {
  const tar = await import('tar');
  await tar.extract({
    file: tarPath,
    cwd: destDir,
    strip: 1,
  });
}

export async function ensureJavaRuntime(
  version: JavaVersion,
  baseDir: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const existingPath = getJavaRuntimePath(version, baseDir);
  if (existingPath) return existingPath;

  const platform = getPlatformKey();
  const arch = "x64";
  const downloadUrl = JAVA_DOWNLOADS[platform]?.[arch]?.[version];
  
  if (!downloadUrl) {
    throw new Error(`Java ${version} not available for ${platform}/${arch}`);
  }

  const javaBaseDir = join(baseDir, "java");
  if (!existsSync(javaBaseDir)) {
    mkdirSync(javaBaseDir, { recursive: true });
  }

  const isZip = downloadUrl.endsWith('.zip');
  const isTarGz = downloadUrl.endsWith('.tar.gz');
  const tempFile = join(javaBaseDir, `temp-${version}${isZip ? '.zip' : '.tar.gz'}`);
  
  onProgress?.(`Скачиваем Java ${version.replace('java', '')}...`);
  await downloadFile(downloadUrl, tempFile);

  onProgress?.(`Распаковываем Java ${version.replace('java', '')}...`);
  
  const extractDir = join(javaBaseDir, `extract-${version}`);
  mkdirSync(extractDir, { recursive: true });

  if (isZip) {
    const zip = new AdmZip(tempFile);
    zip.extractAllTo(extractDir, true);
  } else if (isTarGz) {
    await extractTarGz(tempFile, extractDir);
  }

  // Find the actual java directory
  let actualJavaDir = extractDir;
  
  function findJavaDir(dir: string, depth: number = 0): string | null {
    if (depth > 3) return null;
    
    const binPath = join(dir, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (existsSync(binPath)) return dir;
    
    try {
      const subDirs = readdirSync(dir);
      for (const subDir of subDirs) {
        const fullPath = join(dir, subDir);
        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          const result = findJavaDir(fullPath, depth + 1);
          if (result) return result;
        }
      }
    } catch {
      // Ignore read errors
    }
    
    return null;
  }
  
  const foundDir = findJavaDir(extractDir);
  if (foundDir) {
    actualJavaDir = foundDir;
  }

  // Move files to correct location
  const targetDir = join(javaBaseDir, version, platform, arch);
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });

  const files = readdirSync(actualJavaDir);
  for (const file of files) {
    try {
      const sourcePath = join(actualJavaDir, file);
      const targetPath = join(targetDir, file);
      copySync(sourcePath, targetPath, { overwrite: true });
    } catch (e) {
      console.warn(`Failed to copy ${file}:`, e);
    }
  }

  // Clean up
  try {
    rmSync(extractDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }

  try {
    unlinkSync(tempFile);
  } catch (e) {
    // Ignore cleanup errors
  }

  onProgress?.(`Java ${version.replace('java', '')} установлена!`);
  
  const finalJavaExe = join(targetDir, "bin", process.platform === "win32" ? "java.exe" : "java");
  
  if (!existsSync(finalJavaExe)) {
    throw new Error(`Failed to install Java: ${finalJavaExe} not found`);
  }
  
  return finalJavaExe;
}

export async function findJavaInstallations(): Promise<Array<{ path: string; version: string }>> {
  const results: Array<{ path: string; version: string }> = [];
  const candidates: string[] = [];

  // JAVA_HOME
  if (process.env.JAVA_HOME) {
    candidates.push(join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"));
  }

  // Windows common paths
  if (process.platform === "win32") {
    const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean);
    const vendors = ["Java", "Eclipse Adoptium", "Microsoft", "Zulu", "Amazon Corretto", "BellSoft"];
    
    for (const pf of programFiles) {
      for (const vendor of vendors) {
        const base = join(pf!, vendor);
        if (existsSync(base)) {
          try {
            const versions = readdirSync(base);
            for (const v of versions) {
              const javaPath = join(base, v, "bin", "java.exe");
              if (existsSync(javaPath)) {
                candidates.push(javaPath);
              }
            }
          } catch {
            // Ignore
          }
        }
      }
    }
  } else {
    // Linux/Mac common paths
    candidates.push("/usr/bin/java", "/usr/local/bin/java");
  }

  candidates.push("java");

  const seen = new Set<string>();
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);

    try {
      const { stdout } = await execAsync(`"${candidate}" -version 2>&1`);
      const match = stdout.match(/version "([^"]+)"/);
      if (match) {
        results.push({ path: candidate, version: match[1] });
      }
    } catch {
      // Skip invalid java
    }
  }

  return results;
}

export function needLegacyJava(mcVersion: string): boolean {
  const match = mcVersion.match(/^(\d+)\.(\d+)/);
  if (!match) return false;
  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);
  const versionNum = major === 1 ? minor : major;
  return versionNum <= 16;
}

export function getRequiredJavaVersion(mcVersion: string): JavaVersion {
  if (needLegacyJava(mcVersion)) return "java8";
  
  const match = mcVersion.match(/^(\d+)\.(\d+)/);
  if (!match) return "java21";
  
  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);
  const versionNum = major === 1 ? minor : major;
  
  if (versionNum <= 17) return "java17";
  return "java21";
}