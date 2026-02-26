import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
    Box, Weight, Clock, Trophy, Medal, Award, ArrowRight,
    Plus, Trash2, X, Search, Users, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────
type MainTab = "peso" | "tempo" | "grupos";

interface RankedPiece {
    id: string;
    name: string;
    image_url: string | null;
    material: string | null;
    peso_g: number | null;
    tempo_impressao_min: number | null;
}

interface Group {
    id: string;
    name: string;
    pieceIds: string[];
}

// ── Helpers ──────────────────────────────────────────────
function formatMinutes(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
}

function getMedalIcon(rank: number) {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

function getMedalBg(rank: number) {
    if (rank === 1) return "border-yellow-400/40 bg-yellow-400/5";
    if (rank === 2) return "border-slate-300/40 bg-slate-300/5";
    if (rank === 3) return "border-amber-600/40 bg-amber-600/5";
    return "border-border/50";
}

// ── Filter definitions ───────────────────────────────────
const TIME_FILTERS = [
    { label: "Todos", min: 0, max: Infinity },
    { label: "≤ 1h", min: 0, max: 60 },
    { label: "1h–2h", min: 60, max: 120 },
    { label: "2h–3h", min: 120, max: 180 },
    { label: "3h–4h", min: 180, max: 240 },
    { label: "> 4h", min: 240, max: Infinity },
];

const WEIGHT_FILTERS = [
    { label: "Todos", min: 0, max: Infinity },
    { label: "≤ 50g", min: 0, max: 50 },
    { label: "50–100g", min: 50, max: 100 },
    { label: "100–200g", min: 100, max: 200 },
    { label: "200–500g", min: 200, max: 500 },
    { label: "> 500g", min: 500, max: Infinity },
];

const STORAGE_KEY = "gk_piece_groups";

function loadGroups(): Group[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveGroups(groups: Group[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

// ── FilterChips ──────────────────────────────────────────
function FilterChips({
    filters, activeIdx, onChange,
}: {
    filters: { label: string }[];
    activeIdx: number;
    onChange: (i: number) => void;
}) {
    return (
        <div className="flex flex-wrap gap-1.5 mb-5">
            {filters.map((f, i) => (
                <button
                    key={f.label}
                    onClick={() => onChange(i)}
                    className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150",
                        i === activeIdx
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                >
                    {f.label}
                </button>
            ))}
        </div>
    );
}

// ── RankingList ──────────────────────────────────────────
function RankingList({
    ranked, maxValue, getValue, getValueLabel, emptyMsg,
}: {
    ranked: RankedPiece[];
    maxValue: number;
    getValue: (p: RankedPiece) => number;
    getValueLabel: (p: RankedPiece) => string;
    emptyMsg: string;
}) {
    if (ranked.length === 0) {
        return (
            <div className="card-gradient rounded-xl border border-dashed border-border/50 flex flex-col items-center justify-center py-20 text-center">
                <Box className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="font-medium mb-1">Nenhuma peça neste filtro</p>
                <p className="text-sm text-muted-foreground">{emptyMsg}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Top 3 Podium */}
            {ranked.slice(0, 3).length >= 2 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[ranked[1], ranked[0], ranked[2]].map((piece, podiumIdx) => {
                        if (!piece) return <div key={podiumIdx} />;
                        const rank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
                        const Icon = rank === 1 ? Trophy : rank === 2 ? Medal : Award;
                        const color = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-600";
                        const imgSize = rank === 1 ? "w-16 h-16" : "w-14 h-14";
                        const mt = rank === 1 ? "-mt-4" : "pt-6";
                        return (
                            <Link key={piece.id} to={`/piece/${piece.id}`} className="group">
                                <div className={cn("card-gradient rounded-xl border-2 p-4 text-center transition-all duration-200 hover:scale-[1.02]", getMedalBg(rank), mt)}>
                                    <Icon className={cn("mx-auto mb-2", color, rank === 1 ? "h-8 w-8" : "h-7 w-7")} />
                                    {piece.image_url ? (
                                        <img src={piece.image_url} alt={piece.name} className={cn(imgSize, "rounded-lg object-cover mx-auto mb-2")} />
                                    ) : (
                                        <div className={cn(imgSize, "rounded-lg bg-muted/40 flex items-center justify-center mx-auto mb-2")}>
                                            <Box className="h-6 w-6 text-muted-foreground/40" />
                                        </div>
                                    )}
                                    <p className="font-semibold text-sm leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">{piece.name}</p>
                                    <p className={cn("font-bold", color, rank === 1 ? "text-xl" : "text-lg")}>{getValueLabel(piece)}</p>
                                    <p className="text-[10px] text-muted-foreground">{piece.material || "—"}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Full list */}
            <div className="card-gradient rounded-xl border border-border/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                    <p className="text-sm font-semibold">Todos os resultados</p>
                    <p className="text-xs text-muted-foreground">{ranked.length} peças</p>
                </div>
                <div className="divide-y divide-border/30">
                    {ranked.map((piece, i) => {
                        const pct = (getValue(piece) / maxValue) * 100;
                        const rank = i + 1;
                        return (
                            <Link
                                key={piece.id}
                                to={`/piece/${piece.id}`}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors group"
                            >
                                <div className="flex h-7 w-7 items-center justify-center shrink-0">{getMedalIcon(rank)}</div>
                                {piece.image_url ? (
                                    <img src={piece.image_url} alt={piece.name} className="w-9 h-9 rounded-md object-cover shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                                        <Box className="h-4 w-4 text-muted-foreground/40" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{piece.name}</p>
                                        <span className={cn("text-sm font-bold ml-3 shrink-0", rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-foreground")}>
                                            {getValueLabel(piece)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-500", rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-slate-300" : rank === 3 ? "bg-amber-600" : "bg-primary/60")}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{piece.material || "Sem material"}</p>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── GroupCard ─────────────────────────────────────────────
function GroupCard({
    group, pieces, onRemovePiece, onDeleteGroup,
}: {
    group: Group;
    pieces: RankedPiece[];
    onRemovePiece: (groupId: string, pieceId: string) => void;
    onDeleteGroup: (groupId: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(true);
    const [adding, setAdding] = useState(false);

    const groupPieces = pieces.filter((p) => group.pieceIds.includes(p.id));

    const totalMinutes = groupPieces.reduce((acc, p) => acc + (p.tempo_impressao_min ?? 0), 0);
    const totalPesoG = groupPieces.reduce((acc, p) => acc + (p.peso_g ?? 0), 0);
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;

    const available = pieces.filter(
        (p) => !group.pieceIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="card-gradient rounded-xl border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{group.name}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">{group.pieceIds.length} peça{group.pieceIds.length !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground transition-colors">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => onDeleteGroup(group.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="p-4 space-y-4">
                    {/* Totals */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-muted/20 rounded-lg p-3 text-center border border-border/40">
                            <Clock className="h-4 w-4 text-primary mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Tempo Total</p>
                            <p className="font-bold text-sm">{totalMinutes === 0 ? "—" : `${totalH}h ${totalM}min`}</p>
                        </div>
                        <div className="bg-muted/20 rounded-lg p-3 text-center border border-border/40">
                            <Weight className="h-4 w-4 text-primary mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Peso Total</p>
                            <p className="font-bold text-sm">{totalPesoG === 0 ? "—" : `${totalPesoG.toFixed(0)} g`}</p>
                        </div>
                        <div className="bg-muted/20 rounded-lg p-3 text-center border border-border/40">
                            <Box className="h-4 w-4 text-primary mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Filamento ≈</p>
                            <p className="font-bold text-sm">{totalPesoG === 0 ? "—" : `${(totalPesoG / 1000).toFixed(3)} kg`}</p>
                        </div>
                    </div>

                    {/* Piece list */}
                    {groupPieces.length > 0 && (
                        <div className="space-y-1.5">
                            {groupPieces.map((p) => (
                                <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/10 border border-border/30">
                                    {p.image_url ? (
                                        <img src={p.image_url} alt={p.name} className="w-7 h-7 rounded object-cover shrink-0" />
                                    ) : (
                                        <div className="w-7 h-7 rounded bg-muted/40 flex items-center justify-center shrink-0">
                                            <Box className="h-3 w-3 text-muted-foreground/40" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{p.name}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {p.peso_g != null ? `${p.peso_g}g` : "sem peso"}
                                            {p.peso_g != null && p.tempo_impressao_min != null ? " · " : ""}
                                            {p.tempo_impressao_min != null ? formatMinutes(p.tempo_impressao_min) : ""}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => onRemovePiece(group.id, p.id)}
                                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add piece */}
                    {adding ? (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    autoFocus
                                    placeholder="Buscar peça..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8 h-8 text-sm"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border/40 bg-muted/10 p-1">
                                {available.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma peça disponível</p>
                                ) : (
                                    available.map((p) => (
                                        <button
                                            key={p.id}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/30 transition-colors text-left"
                                            onClick={() => {
                                                // handled by parent via callback
                                                const event = new CustomEvent("gk-add-piece", { detail: { groupId: group.id, pieceId: p.id } });
                                                window.dispatchEvent(event);
                                            }}
                                        >
                                            {p.image_url ? (
                                                <img src={p.image_url} alt={p.name} className="w-6 h-6 rounded object-cover" />
                                            ) : (
                                                <div className="w-6 h-6 rounded bg-muted/40 flex items-center justify-center">
                                                    <Box className="h-3 w-3 text-muted-foreground/40" />
                                                </div>
                                            )}
                                            <span className="text-sm truncate">{p.name}</span>
                                            {p.peso_g != null && <span className="text-[10px] text-muted-foreground ml-auto">{p.peso_g}g</span>}
                                        </button>
                                    ))
                                )}
                            </div>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => { setAdding(false); setSearch(""); }}>
                                Fechar
                            </Button>
                        </div>
                    ) : (
                        <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={() => setAdding(true)}>
                            <Plus className="h-3.5 w-3.5" /> Adicionar peça
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────
export default function Rankings() {
    const [pieces, setPieces] = useState<RankedPiece[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<MainTab>("peso");
    const [timeFilterIdx, setTimeFilterIdx] = useState(0);
    const [weightFilterIdx, setWeightFilterIdx] = useState(0);
    const [groups, setGroups] = useState<Group[]>(loadGroups);
    const [newGroupName, setNewGroupName] = useState("");
    const [creatingGroup, setCreatingGroup] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchPieces();
    }, []);

    // Listen for add-piece events from GroupCard
    useEffect(() => {
        const handler = (e: Event) => {
            const { groupId, pieceId } = (e as CustomEvent).detail;
            setGroups((prev) => {
                const updated = prev.map((g) =>
                    g.id === groupId && !g.pieceIds.includes(pieceId)
                        ? { ...g, pieceIds: [...g.pieceIds, pieceId] }
                        : g
                );
                saveGroups(updated);
                return updated;
            });
        };
        window.addEventListener("gk-add-piece", handler);
        return () => window.removeEventListener("gk-add-piece", handler);
    }, []);

    const fetchPieces = async () => {
        try {
            const { data, error } = await supabase
                .from("pieces")
                .select("id, name, image_url, material, peso_g, tempo_impressao_min")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setPieces((data as any) || []);
        } catch (error: any) {
            toast({ title: "Erro ao carregar peças", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Ranked lists
    const rankedByPeso = useMemo(() =>
        [...pieces]
            .filter((p) => p.peso_g != null && p.peso_g > 0)
            .sort((a, b) => (b.peso_g ?? 0) - (a.peso_g ?? 0)),
        [pieces]
    );

    const rankedByTempo = useMemo(() =>
        [...pieces]
            .filter((p) => p.tempo_impressao_min != null && p.tempo_impressao_min > 0)
            .sort((a, b) => (b.tempo_impressao_min ?? 0) - (a.tempo_impressao_min ?? 0)),
        [pieces]
    );

    // Filtered
    const wf = WEIGHT_FILTERS[weightFilterIdx];
    const tf = TIME_FILTERS[timeFilterIdx];

    const filteredPeso = useMemo(() =>
        rankedByPeso.filter((p) => (p.peso_g ?? 0) > wf.min && (p.peso_g ?? 0) <= wf.max),
        [rankedByPeso, wf]
    );

    const filteredTempo = useMemo(() =>
        rankedByTempo.filter((p) => (p.tempo_impressao_min ?? 0) > tf.min && (p.tempo_impressao_min ?? 0) <= tf.max),
        [rankedByTempo, tf]
    );

    const pesoMax = filteredPeso[0]?.peso_g ?? 1;
    const tempoMax = filteredTempo[0]?.tempo_impressao_min ?? 1;

    // Groups handlers
    const createGroup = () => {
        if (!newGroupName.trim()) return;
        const g: Group = { id: crypto.randomUUID(), name: newGroupName.trim(), pieceIds: [] };
        const updated = [...groups, g];
        setGroups(updated);
        saveGroups(updated);
        setNewGroupName("");
        setCreatingGroup(false);
    };

    const deleteGroup = (id: string) => {
        const updated = groups.filter((g) => g.id !== id);
        setGroups(updated);
        saveGroups(updated);
    };

    const removePieceFromGroup = (groupId: string, pieceId: string) => {
        const updated = groups.map((g) =>
            g.id === groupId ? { ...g, pieceIds: g.pieceIds.filter((pid) => pid !== pieceId) } : g
        );
        setGroups(updated);
        saveGroups(updated);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center space-y-3">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground">Carregando ranking...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[860px] mx-auto">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-yellow-400" />
                        Ranking de Peças
                    </h1>
                    <p className="page-subtitle">
                        {tab === "peso" && "Peças classificadas do mais pesado ao mais leve"}
                        {tab === "tempo" && "Peças classificadas pela maior duração de impressão"}
                        {tab === "grupos" && "Monte grupos de impressão e veja os totais"}
                    </p>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/50 w-fit mb-6">
                {(
                    [
                        { key: "peso", icon: <Weight className="h-4 w-4" />, label: "Mais Pesada" },
                        { key: "tempo", icon: <Clock className="h-4 w-4" />, label: "Mais Demorada" },
                        { key: "grupos", icon: <Users className="h-4 w-4" />, label: "Grupos" },
                    ] as { key: MainTab; icon: React.ReactNode; label: string }[]
                ).map(({ key, icon, label }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                            tab === key
                                ? "bg-card shadow-sm text-foreground border border-border/60"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Peso Tab ── */}
            {tab === "peso" && (
                <>
                    <FilterChips filters={WEIGHT_FILTERS} activeIdx={weightFilterIdx} onChange={setWeightFilterIdx} />
                    <RankingList
                        ranked={filteredPeso}
                        maxValue={pesoMax}
                        getValue={(p) => p.peso_g ?? 0}
                        getValueLabel={(p) => `${(p.peso_g ?? 0).toFixed(1)} g`}
                        emptyMsg="Nenhuma peça nessa faixa de peso. Tente outro filtro."
                    />
                </>
            )}

            {/* ── Tempo Tab ── */}
            {tab === "tempo" && (
                <>
                    <FilterChips filters={TIME_FILTERS} activeIdx={timeFilterIdx} onChange={setTimeFilterIdx} />
                    <RankingList
                        ranked={filteredTempo}
                        maxValue={tempoMax}
                        getValue={(p) => p.tempo_impressao_min ?? 0}
                        getValueLabel={(p) => formatMinutes(p.tempo_impressao_min ?? 0)}
                        emptyMsg="Nenhuma peça nessa faixa de tempo. Tente outro filtro."
                    />
                </>
            )}

            {/* ── Grupos Tab ── */}
            {tab === "grupos" && (
                <div className="space-y-4">
                    {/* New group */}
                    {creatingGroup ? (
                        <div className="card-gradient rounded-xl border border-border/50 p-4 flex gap-2">
                            <Input
                                autoFocus
                                placeholder="Nome do grupo (ex: Pedido João)"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") createGroup(); if (e.key === "Escape") setCreatingGroup(false); }}
                                className="h-9 text-sm"
                            />
                            <Button size="sm" onClick={createGroup} disabled={!newGroupName.trim()}>Criar</Button>
                            <Button size="sm" variant="outline" onClick={() => { setCreatingGroup(false); setNewGroupName(""); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button className="gap-2" onClick={() => setCreatingGroup(true)}>
                            <Plus className="h-4 w-4" /> Novo Grupo
                        </Button>
                    )}

                    {/* Groups list */}
                    {groups.length === 0 ? (
                        <div className="card-gradient rounded-xl border border-dashed border-border/50 flex flex-col items-center justify-center py-20 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <p className="font-medium mb-1">Nenhum grupo criado</p>
                            <p className="text-sm text-muted-foreground">Crie um grupo para montar um conjunto de peças e ver o total de tempo e filamento</p>
                        </div>
                    ) : (
                        groups.map((group) => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                pieces={pieces}
                                onRemovePiece={removePieceFromGroup}
                                onDeleteGroup={deleteGroup}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
