import { useState } from "react";
import { Upload, Package, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useLauncherStore } from "../store/useLauncherStore";
import { useLocale } from "../hooks/useLocale";

interface ModpackMetadata {
    name: string;
    version: string | null;
    author: string | null;
    description: string | null;
    mcVersion: string | null;
    loader: string;
    loaderVersion: string | null;
    type: "modrinth" | "curseforge" | "zip";
}

export function ModpackImportPage() {
    const { t } = useLocale();
    const { setSelectedInstance, loadInstances, setPage } = useLauncherStore();
    const [step, setStep] = useState<"select" | "metadata" | "importing" | "done">("select");
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
    const [instanceName, setInstanceName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [importedInstanceId, setImportedInstanceId] = useState<string | null>(null);

    const handleSelectFile = async () => {
        setError(null);
        try {
            const filePath = await window.murflame.instances.pickZip();
            if (!filePath) return;

            setSelectedFile(filePath);
            const meta = await window.murflame.instances.readModpackMetadata(filePath);
            setMetadata(meta);
            setInstanceName(meta.name || "Imported Modpack");
            setStep("metadata");
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleImport = async () => {
        if (!selectedFile || !instanceName.trim()) return;

        setStep("importing");
        setError(null);

        try {
            const newInstance = await window.murflame.instances.importModpack(
                selectedFile,
                instanceName.trim()
            );
            setImportedInstanceId(newInstance.id);
            await loadInstances();
            setStep("done");
        } catch (err) {
            setError((err as Error).message);
            setStep("metadata");
        }
    };

    const handleGoToInstance = () => {
        if (importedInstanceId) {
            setSelectedInstance(importedInstanceId);
            setPage("home");
        }
    };

    return (
        <div className="modpack-import-page">
            <div className="page-header">
                <h2>{t("modpack.importTitle")}</h2>
                <p>Установка модпаков из архивов .zip и .mrpack (Modrinth)</p>
            </div>

            {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {step === "select" && (
                <div className="import-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <div className="import-icon" style={{ fontSize: 64, marginBottom: 24 }}>
                        📦
                    </div>
                    <h3>{t("modpack.selectFile")}</h3>
                    <p style={{ color: "var(--text-muted)", marginTop: 8, marginBottom: 24 }}>
                        Поддерживаются форматы: .zip (CurseForge), .mrpack (Modrinth)
                    </p>
                    <button className="btn btn-primary" onClick={handleSelectFile}>
                        <Upload size={16} />
                        {t("modpack.selectFile")}
                    </button>
                </div>
            )}

            {step === "metadata" && metadata && (
                <div className="import-card">
                    <div className="metadata-preview">
                        <div className="metadata-header">
                            <Package size={32} />
                            <div>
                                <h3>{metadata.name}</h3>
                                {metadata.author && <p>Автор: {metadata.author}</p>}
                            </div>
                        </div>

                        <div className="metadata-details">
                            <div className="detail-row">
                                <span className="label">Тип:</span>
                                <span className="value">
                                    {metadata.type === "modrinth" && "Modrinth"}
                                    {metadata.type === "curseforge" && "CurseForge"}
                                    {metadata.type === "zip" && "ZIP архив"}
                                </span>
                            </div>
                            {metadata.version && (
                                <div className="detail-row">
                                    <span className="label">Версия:</span>
                                    <span className="value">{metadata.version}</span>
                                </div>
                            )}
                            {metadata.mcVersion && (
                                <div className="detail-row">
                                    <span className="label">Minecraft:</span>
                                    <span className="value">{metadata.mcVersion}</span>
                                </div>
                            )}
                            <div className="detail-row">
                                <span className="label">Загрузчик:</span>
                                <span className="value">
                                    {metadata.loader === "vanilla" && "Vanilla"}
                                    {metadata.loader === "fabric" && "Fabric"}
                                    {metadata.loader === "forge" && "Forge"}
                                    {metadata.loader === "quilt" && "Quilt"}
                                    {metadata.loaderVersion && ` (${metadata.loaderVersion})`}
                                </span>
                            </div>
                            {metadata.description && (
                                <div className="detail-row">
                                    <span className="label">Описание:</span>
                                    <span className="value description">{metadata.description}</span>
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ marginTop: 24 }}>
                            <label>{t("modpack.instanceName")}</label>
                            <input
                                type="text"
                                className="input"
                                value={instanceName}
                                onChange={(e) => setInstanceName(e.target.value)}
                                placeholder="Введите название..."
                            />
                        </div>

                        <div className="import-actions" style={{ display: "flex", gap: 12, marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setStep("select")}>
                                Назад
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleImport}
                                disabled={!instanceName.trim()}
                            >
                                <Upload size={16} />
                                {t("modpack.import")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step === "importing" && (
                <div className="import-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <Loader2 size={48} style={{ animation: "spin 1s linear infinite", marginBottom: 24 }} />
                    <h3>{t("modpack.importing")}</h3>
                    <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
                        Пожалуйста, подождите, файлы копируются
                    </p>
                </div>
            )}

            {step === "done" && (
                <div className="import-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                    <CheckCircle size={48} style={{ color: "#10b981", marginBottom: 24 }} />
                    <h3>Готово!</h3>
                    <p style={{ color: "var(--text-muted)", marginTop: 8, marginBottom: 24 }}>
                        Модпак "{instanceName}" успешно установлен
                    </p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <button className="btn btn-secondary" onClick={() => setPage("home")}>
                            {t("nav.home")}
                        </button>
                        <button className="btn btn-primary" onClick={handleGoToInstance}>
                            {t("modpack.goToInstance") || "Перейти к сборке"}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .import-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 24px;
                    padding: 24px;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .metadata-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border);
                }
                .metadata-header h3 {
                    margin: 0;
                    font-size: 1.3rem;
                }
                .metadata-header p {
                    margin: 4px 0 0;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                }
                .metadata-details {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .detail-row {
                    display: flex;
                    gap: 12px;
                }
                .detail-row .label {
                    width: 100px;
                    color: var(--text-muted);
                    font-size: 0.85rem;
                }
                .detail-row .value {
                    flex: 1;
                    color: var(--text-primary);
                    font-size: 0.85rem;
                }
                .detail-row .value.description {
                    color: var(--text-muted);
                    font-style: italic;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}