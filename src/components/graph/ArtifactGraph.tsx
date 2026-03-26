"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/src/components/Input";
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  GraphIcon,
} from "@/src/components/icons/LoopIcons";
import type {
  ArtifactGraphCollection,
  ArtifactGraphNode,
  ArtifactGraphSnapshot,
} from "@/src/server/services/artifactGraphService";

type Mode = "overview" | "full";

type Neighbor = {
  node: ArtifactGraphNode;
  reason: string;
  weight: number;
};

type CanvasNodeTone = "root" | "collection" | "smart" | "artifact" | "accent";

type TreeCard = {
  id: string;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  width: number;
  canvasWidth: number;
  canvasHeight: number;
  tone: CanvasNodeTone;
  active?: boolean;
  muted?: boolean;
  compact?: boolean;
  dotted?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onAdvance?: () => void;
};

type Point = {
  x: number;
  y: number;
};

export function ArtifactGraph(props: {
  workspaceSlug: string;
  graph: ArtifactGraphSnapshot;
  mode?: Mode;
  title?: string;
  subtitle?: string;
}) {
  const mode = props.mode ?? "full";
  const isOverview = mode === "overview";
  const router = useRouter();

  const collections = useMemo(
    () => props.graph.collections.slice(0, isOverview ? 5 : props.graph.collections.length),
    [isOverview, props.graph.collections],
  );

  const [selectedCollectionKey, setSelectedCollectionKey] = useState<string>(() =>
    collections[0]?.key ?? "all",
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredCollectionKey, setHoveredCollectionKey] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scale, setScale] = useState(1);
  const [launchingNetwork, setLaunchingNetwork] = useState(false);

  const collectionLookup = useMemo(
    () => new Map(collections.map((collection) => [collection.key, collection])),
    [collections],
  );

  useEffect(() => {
    if (collections.length === 0) return;
    if (!collectionLookup.has(selectedCollectionKey)) {
      setSelectedCollectionKey(collections[0]?.key ?? "all");
    }
  }, [collectionLookup, collections, selectedCollectionKey]);

  useEffect(() => {
    if (isOverview) {
      router.prefetch(`/w/${props.workspaceSlug}/network`);
    }
  }, [isOverview, props.workspaceSlug, router]);

  const visibleCollections =
    !isOverview && selectedCollectionKey !== "all"
      ? collections.filter((collection) => collection.key === selectedCollectionKey)
      : collections;

  const visibleCollectionKeys = useMemo(
    () => new Set(visibleCollections.map((collection) => collection.key)),
    [visibleCollections],
  );

  const visibleNodes = useMemo(
    () => props.graph.nodes.filter((node) => visibleCollectionKeys.has(node.collectionKey)),
    [props.graph.nodes, visibleCollectionKeys],
  );

  const nodeLookup = useMemo(
    () => new Map(visibleNodes.map((node) => [node.id, node])),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      props.graph.edges.filter((edge) => nodeLookup.has(edge.source) && nodeLookup.has(edge.target)),
    [nodeLookup, props.graph.edges],
  );

  const nodesByCollection = useMemo(() => {
    const map = new Map<string, ArtifactGraphNode[]>();
    for (const node of visibleNodes) {
      const next = map.get(node.collectionKey) ?? [];
      next.push(node);
      map.set(node.collectionKey, next);
    }
    for (const [key, nodes] of map) {
      map.set(
        key,
        [...nodes].sort((left, right) => {
          if (right.degree !== left.degree) return right.degree - left.degree;
          return left.title.localeCompare(right.title);
        }),
      );
    }
    return map;
  }, [visibleNodes]);

  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Neighbor[]>();
    for (const edge of visibleEdges) {
      const source = nodeLookup.get(edge.source);
      const target = nodeLookup.get(edge.target);
      if (!source || !target) continue;

      const left = map.get(source.id) ?? [];
      left.push({
        node: target,
        reason: edge.primaryReason,
        weight: edge.weight,
      });
      map.set(source.id, left);

      const right = map.get(target.id) ?? [];
      right.push({
        node: source,
        reason: edge.primaryReason,
        weight: edge.weight,
      });
      map.set(target.id, right);
    }

    for (const [key, neighbors] of map) {
      map.set(
        key,
        neighbors.sort((left, right) => right.weight - left.weight || left.node.title.localeCompare(right.node.title)),
      );
    }

    return map;
  }, [nodeLookup, visibleEdges]);

  const activeCollectionKey =
    hoveredCollectionKey ??
    (selectedNodeId ? nodeLookup.get(selectedNodeId)?.collectionKey ?? null : null) ??
    selectedCollectionKey ??
    collections[0]?.key ??
    null;

  const activeCollection = activeCollectionKey ? collectionLookup.get(activeCollectionKey) ?? null : null;

  useEffect(() => {
    if (!selectedNodeId && activeCollection) {
      const firstNode = (nodesByCollection.get(activeCollection.key) ?? [])[0];
      if (firstNode) setSelectedNodeId(firstNode.id);
    }
  }, [activeCollection, nodesByCollection, selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId && !nodeLookup.has(selectedNodeId)) {
      const fallback = activeCollection ? (nodesByCollection.get(activeCollection.key) ?? [])[0] : visibleNodes[0];
      setSelectedNodeId(fallback?.id ?? null);
    }
  }, [activeCollection, nodeLookup, nodesByCollection, selectedNodeId, visibleNodes]);

  const selectedNode = selectedNodeId ? nodeLookup.get(selectedNodeId) ?? null : null;

  const fullRootNode =
    selectedNode ??
    (activeCollection ? (nodesByCollection.get(activeCollection.key) ?? [])[0] ?? null : visibleNodes[0] ?? null);

  const branchNeighbors = fullRootNode
    ? listNeighbors(adjacencyMap, fullRootNode.id, {
        limit: 5,
      })
    : [];

  const fallbackBranchNodes =
    activeCollection
      ? (nodesByCollection.get(activeCollection.key) ?? [])
          .filter((node) => node.id !== fullRootNode?.id)
          .slice(0, 5)
          .map((node) => ({
            node,
            reason: node.blockThemes[0] ?? "Artifact",
            weight: node.degree,
          }))
      : [];

  const visibleBranchNodes = branchNeighbors.length > 0 ? branchNeighbors : fallbackBranchNodes;

  const activeBranchNodeId =
    hoveredNodeId && visibleBranchNodes.some((item) => item.node.id === hoveredNodeId)
      ? hoveredNodeId
      : expandedNodeId && visibleBranchNodes.some((item) => item.node.id === expandedNodeId)
        ? expandedNodeId
        : null;

  const expandedBranchNode = activeBranchNodeId ? nodeLookup.get(activeBranchNodeId) ?? null : null;
  const tertiaryNeighbors =
    expandedBranchNode && fullRootNode
      ? listNeighbors(adjacencyMap, expandedBranchNode.id, {
          limit: 3,
          excludeIds: [fullRootNode.id],
        })
      : [];

  const overviewCollection = activeCollection ?? collections[0] ?? null;
  const overviewArtifacts = overviewCollection
    ? (nodesByCollection.get(overviewCollection.key) ?? []).slice(0, 4)
    : [];
  const overviewFocusedArtifact =
    (hoveredNodeId ? overviewArtifacts.find((node) => node.id === hoveredNodeId) : null) ??
    (selectedNodeId ? overviewArtifacts.find((node) => node.id === selectedNodeId) : null) ??
    overviewArtifacts[0] ??
    null;
  const overviewRelated =
    overviewFocusedArtifact
      ? listNeighbors(adjacencyMap, overviewFocusedArtifact.id, {
          limit: 3,
          excludeIds: overviewArtifacts.map((node) => node.id),
        })
      : [];

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || isOverview) return [];
    return visibleNodes
      .filter(
        (node) =>
          node.title.toLowerCase().includes(normalized) ||
          node.collectionName.toLowerCase().includes(normalized) ||
          node.keywords.some((keyword) => keyword.includes(normalized)),
      )
      .slice(0, 6);
  }, [isOverview, query, visibleNodes]);

  function focusNode(nodeId: string) {
    const node = nodeLookup.get(nodeId);
    setSelectedNodeId(nodeId);
    setExpandedNodeId(null);
    if (node) setSelectedCollectionKey(node.collectionKey);
  }

  function advanceToNode(nodeId: string) {
    focusNode(nodeId);
  }

  function selectCollection(collectionKey: string) {
    setSelectedCollectionKey(collectionKey);
    const firstNode = (nodesByCollection.get(collectionKey) ?? [])[0];
    if (firstNode) setSelectedNodeId(firstNode.id);
  }

  function pickSuggestion(nodeId: string) {
    focusNode(nodeId);
    setQuery("");
  }

  function zoom(delta: number) {
    setScale((current) => clampNumber(current + delta, 0.88, 1.18));
  }

  function resetView() {
    setScale(1);
    setExpandedNodeId(null);
    setHoveredNodeId(null);
  }

  function openNetwork() {
    if (!isOverview || launchingNetwork) return;
    setLaunchingNetwork(true);
    window.setTimeout(() => {
      router.push(`/w/${props.workspaceSlug}/network`);
    }, 200);
  }

  return (
    <section
      className={[
        "glass-strong rounded-[30px] border border-slate-300 bg-white/88 shadow-[0_26px_86px_-56px_rgba(4,12,27,0.16)]",
        isOverview ? "p-5" : "p-6",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <GraphIcon className="h-4 w-4" />
            {props.title ?? "Network"}
          </div>
          {isOverview ? (
            <>
              <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-slate-950">
                A high-level map of the workspace
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {props.subtitle || "Hover to trace a path. Click to follow it."}
              </p>
            </>
          ) : null}
        </div>

        {isOverview ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNetwork}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 shadow-[0_10px_28px_-22px_rgba(4,12,27,0.24)] transition hover:border-slate-400 hover:bg-slate-50"
              aria-label="Open network"
              title="Open network"
            >
              <ArrowUpRightIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_10px_24px_-22px_rgba(4,12,27,0.18)]">
            {visibleNodes.length} docs
          </div>
        )}
      </div>

      {!isOverview ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1 max-w-[520px]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search artifacts, groups, or themes"
              />
              {suggestions.length > 0 ? (
                <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-[22px] border border-slate-300 bg-white p-2 shadow-[0_24px_50px_-28px_rgba(4,12,27,0.16)]">
                  {suggestions.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-slate-50"
                      onClick={() => pickSuggestion(node.id)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{node.title}</div>
                        <div className="truncate text-xs text-slate-500">{node.collectionName}</div>
                      </div>
                      <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600">
                        {node.keywords[0] ?? "artifact"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              <GraphFilterChip
                label="All"
                meta={`${collections.length}`}
                active={selectedCollectionKey === "all"}
                onClick={() => setSelectedCollectionKey("all")}
              />
              {collections.map((collection) => (
                <GraphFilterChip
                  key={collection.key}
                  label={collection.name}
                  meta={`${collection.artifactCount}`}
                  active={selectedCollectionKey === collection.key}
                  onClick={() => selectCollection(collection.key)}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      {isOverview ? (
        <OverviewTree
          workspaceLabel={props.workspaceSlug}
          collections={collections}
          activeCollection={overviewCollection}
          activeArtifact={overviewFocusedArtifact}
          artifacts={overviewArtifacts}
          relatedArtifacts={overviewRelated}
          launching={launchingNetwork}
          onCollectionSelect={selectCollection}
          onCollectionHover={setHoveredCollectionKey}
          onCollectionLeave={() => setHoveredCollectionKey(null)}
          onArtifactSelect={(nodeId) => {
            setSelectedNodeId(nodeId);
            setHoveredNodeId(null);
          }}
          onArtifactHover={setHoveredNodeId}
          onArtifactLeave={() => setHoveredNodeId(null)}
        />
      ) : (
        <FullTree
          activeCollection={activeCollection}
          rootNode={fullRootNode}
          branchNodes={visibleBranchNodes}
          expandedBranchNodeId={activeBranchNodeId}
          tertiaryNodes={tertiaryNeighbors}
          scale={scale}
          onZoomIn={() => zoom(0.06)}
          onZoomOut={() => zoom(-0.06)}
          onReset={resetView}
          onCollectionSelect={() => {
            if (!activeCollection) return;
            selectCollection(activeCollection.key);
          }}
          onRootSelect={(nodeId) => focusNode(nodeId)}
          onBranchSelect={(nodeId) => setExpandedNodeId(nodeId)}
          onBranchAdvance={(nodeId) => advanceToNode(nodeId)}
          onNodeHover={setHoveredNodeId}
          onNodeLeave={() => setHoveredNodeId(null)}
          workspaceSlug={props.workspaceSlug}
        />
      )}
    </section>
  );
}

function OverviewTree(props: {
  workspaceLabel: string;
  collections: ArtifactGraphCollection[];
  activeCollection: ArtifactGraphCollection | null;
  activeArtifact: ArtifactGraphNode | null;
  artifacts: ArtifactGraphNode[];
  relatedArtifacts: Neighbor[];
  launching: boolean;
  onCollectionSelect: (collectionKey: string) => void;
  onCollectionHover: (collectionKey: string | null) => void;
  onCollectionLeave: () => void;
  onArtifactSelect: (nodeId: string) => void;
  onArtifactHover: (nodeId: string | null) => void;
  onArtifactLeave: () => void;
}) {
  const width = 1180;
  const height = 440;
  const rootPosition = { x: width / 2, y: 78 };
  const collectionXs = spreadXPositions(props.collections.length, width / 2, 212, 160, width - 160);
  const activeCollectionIndex = props.activeCollection
    ? props.collections.findIndex((collection) => collection.key === props.activeCollection?.key)
    : -1;
  const activeCollectionX = activeCollectionIndex >= 0 ? collectionXs[activeCollectionIndex] : width / 2;
  const collectionY = 196;
  const artifactXs = spreadXPositions(props.artifacts.length, activeCollectionX, 214, 170, width - 170);
  const activeArtifactIndex = props.activeArtifact
    ? props.artifacts.findIndex((artifact) => artifact.id === props.activeArtifact?.id)
    : -1;
  const activeArtifactX = activeArtifactIndex >= 0 ? artifactXs[activeArtifactIndex] : activeCollectionX;
  const artifactY = 308;
  const relatedXs = spreadXPositions(props.relatedArtifacts.length, activeArtifactX, 198, 170, width - 170);
  const relatedY = 384;

  return (
    <div className="mt-5">
      <div
        className={[
          "network-canvas overflow-hidden rounded-[28px] border border-slate-300 transition duration-200",
          props.launching ? "scale-[1.01] opacity-0 blur-[2px]" : "scale-100 opacity-100",
        ].join(" ")}
      >
        <div className="network-canvas-grid" />
        <div className="relative h-[430px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
            {props.collections.map((collection, index) => (
              <path
                key={`root-${collection.key}`}
                d={buildCurvePath(rootPosition.x, rootPosition.y + 34, collectionXs[index], collectionY - 32)}
                className="network-curve"
                opacity={props.activeCollection?.key === collection.key ? 0.86 : 0.3}
              />
            ))}
            {props.activeCollection
              ? props.artifacts.map((artifact, index) => (
                  <path
                    key={`collection-${artifact.id}`}
                    d={buildCurvePath(activeCollectionX, collectionY + 30, artifactXs[index], artifactY - 28)}
                    className="network-curve"
                    opacity={props.activeArtifact?.id === artifact.id ? 0.88 : 0.38}
                  />
                ))
              : null}
            {props.activeArtifact
              ? props.relatedArtifacts.map((item, index) => (
                  <path
                    key={`artifact-${item.node.id}`}
                    d={buildCurvePath(activeArtifactX, artifactY + 28, relatedXs[index], relatedY - 22)}
                    className="network-curve network-curve-active"
                    opacity={0.82}
                  />
                ))
              : null}
          </svg>

          <div className="absolute inset-0">
            <TreeNodeCard
              id="workspace-root"
              label={props.workspaceLabel}
              subtitle={`${props.collections.length} groups`}
              tone="root"
              x={rootPosition.x}
              y={rootPosition.y}
              width={236}
              active
              canvasWidth={width}
              canvasHeight={height}
            />

            {props.collections.map((collection, index) => (
              <TreeNodeCard
                key={collection.key}
                id={collection.key}
                label={collection.name}
                subtitle={describeCollection(collection)}
                tone={collection.kind === "smart" ? "smart" : "collection"}
                x={collectionXs[index]}
                y={collectionY}
                width={198}
                canvasWidth={width}
                canvasHeight={height}
                active={props.activeCollection?.key === collection.key}
                compact
                dotted={collection.kind === "smart"}
                onClick={() => props.onCollectionSelect(collection.key)}
                onMouseEnter={() => props.onCollectionHover(collection.key)}
                onMouseLeave={props.onCollectionLeave}
              />
            ))}

            {props.artifacts.map((artifact, index) => (
              <TreeNodeCard
                key={artifact.id}
                id={artifact.id}
                label={artifact.title}
                subtitle={artifact.blockThemes[0] ?? artifact.collectionName}
                tone="artifact"
                x={artifactXs[index]}
                y={artifactY}
                width={206}
                canvasWidth={width}
                canvasHeight={height}
                active={props.activeArtifact?.id === artifact.id}
                compact
                onClick={() => props.onArtifactSelect(artifact.id)}
                onMouseEnter={() => props.onArtifactHover(artifact.id)}
                onMouseLeave={props.onArtifactLeave}
              />
            ))}

            {props.relatedArtifacts.map((item, index) => (
              <TreeNodeCard
                key={item.node.id}
                id={item.node.id}
                label={item.node.title}
                subtitle={item.reason}
                tone="accent"
                x={relatedXs[index]}
                y={relatedY}
                width={188}
                canvasWidth={width}
                canvasHeight={height}
                muted={!props.activeArtifact}
                compact
              />
            ))}
          </div>
        </div>
      </div>

      <div className="glass mt-3 flex items-center justify-between gap-3 rounded-[20px] border border-slate-300 bg-white/86 px-4 py-2.5 shadow-[0_16px_40px_-32px_rgba(4,12,27,0.16)]">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Focus</div>
          <div className="truncate text-sm font-medium text-slate-900">
            {props.activeArtifact?.title ?? props.activeCollection?.name ?? props.workspaceLabel}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {props.activeArtifact ? `${props.relatedArtifacts.length} linked docs` : `${props.collections.length} groups`}
        </div>
      </div>
    </div>
  );
}

function FullTree(props: {
  workspaceSlug: string;
  activeCollection: ArtifactGraphCollection | null;
  rootNode: ArtifactGraphNode | null;
  branchNodes: Neighbor[];
  expandedBranchNodeId: string | null;
  tertiaryNodes: Neighbor[];
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onCollectionSelect: () => void;
  onRootSelect: (nodeId: string) => void;
  onBranchSelect: (nodeId: string) => void;
  onBranchAdvance: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onNodeLeave: () => void;
}) {
  const width = 1480;
  const height = 760;
  const collectionY = 76;
  const rootX = width / 2;
  const rootY = 194;
  const branchPositions = layoutTier({
    count: props.branchNodes.length,
    centerX: rootX,
    width: 196,
    minX: 160,
    maxX: width - 160,
    maxPerRow: 2,
    baseY: 336,
    rowGap: 100,
  });
  const expandedBranchIndex =
    props.expandedBranchNodeId
      ? props.branchNodes.findIndex((item) => item.node.id === props.expandedBranchNodeId)
      : -1;
  const activeBranchPoint = expandedBranchIndex >= 0 ? branchPositions[expandedBranchIndex] : null;
  const branchBottom = branchPositions.reduce((max, point) => Math.max(max, point.y), 374);
  const tertiaryBaseY = Math.min(700, branchBottom + 148);
  const tertiaryPositions = layoutTier({
    count: props.tertiaryNodes.length,
    centerX: activeBranchPoint?.x ?? rootX,
    width: 184,
    minX: 160,
    maxX: width - 160,
    maxPerRow: 2,
    baseY: tertiaryBaseY,
    rowGap: 96,
  });

  return (
    <div className="mt-5">
      <div className="network-canvas overflow-hidden rounded-[30px] border border-slate-300">
        <div className="network-canvas-grid" />
        <div className="relative h-[760px]">
          <div className="absolute left-6 top-6 z-20 flex flex-wrap items-center gap-2">
            {props.activeCollection ? (
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-[0_10px_24px_-18px_rgba(4,12,27,0.14)]">
                {props.activeCollection.name}
              </span>
            ) : null}
          </div>

          {props.rootNode ? (
            <Link
              href={`/w/${props.workspaceSlug}/artifacts/${props.rootNode.id}`}
              className="absolute right-6 top-6 z-20 inline-flex h-8 shrink-0 items-center rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Open
            </Link>
          ) : null}

          <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
            <CanvasControlButton onClick={props.onZoomOut}>-</CanvasControlButton>
            <button
              type="button"
              onClick={props.onReset}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_10px_24px_-18px_rgba(4,12,27,0.18)] transition hover:border-slate-400 hover:bg-slate-50"
            >
              {Math.round(props.scale * 100)}%
            </button>
            <CanvasControlButton onClick={props.onZoomIn}>+</CanvasControlButton>
          </div>

          <div
            className="absolute inset-0 origin-center transition-transform duration-300"
            style={{ transform: `scale(${props.scale})` }}
            onMouseLeave={props.onNodeLeave}
          >
            <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
              {props.activeCollection ? (
                <path
                  d={buildCurvePath(rootX, collectionY + 24, rootX, rootY - 46)}
                  className="network-curve"
                  opacity={0.74}
                />
              ) : null}
              {props.rootNode
                ? props.branchNodes.map((item, index) => (
                    <path
                      key={`root-${item.node.id}`}
                      d={buildCurvePath(
                        rootX,
                        rootY + 34,
                        branchPositions[index]?.x ?? rootX,
                        (branchPositions[index]?.y ?? 428) - 28,
                      )}
                      className={
                        props.expandedBranchNodeId === item.node.id
                          ? "network-curve network-curve-active"
                          : "network-curve"
                      }
                      opacity={props.expandedBranchNodeId === item.node.id ? 0.9 : 0.34}
                    />
                  ))
                : null}
              {props.expandedBranchNodeId && activeBranchPoint
                ? props.tertiaryNodes.map((item, index) => (
                    <path
                      key={`branch-${item.node.id}`}
                      d={buildCurvePath(
                        activeBranchPoint.x,
                        activeBranchPoint.y + 28,
                        tertiaryPositions[index]?.x ?? activeBranchPoint.x,
                        (tertiaryPositions[index]?.y ?? tertiaryBaseY) - 20,
                      )}
                      className="network-curve network-curve-active"
                      opacity={0.88}
                    />
                  ))
                : null}
            </svg>

            <div className="absolute inset-0">
              {props.activeCollection ? (
                <TreeNodeCard
                  id={props.activeCollection.key}
                  label={props.activeCollection.name}
                  subtitle={describeCollection(props.activeCollection)}
                  tone={props.activeCollection.kind === "smart" ? "smart" : "collection"}
                  x={rootX}
                  y={collectionY}
                  width={214}
                  canvasWidth={width}
                  canvasHeight={height}
                  compact
                  dotted={props.activeCollection.kind === "smart"}
                  onClick={props.onCollectionSelect}
                />
              ) : null}

              {props.rootNode ? (
                <TreeNodeCard
                  id={props.rootNode.id}
                  label={props.rootNode.title}
                  subtitle={props.rootNode.blockThemes[0] ?? props.rootNode.collectionName}
                  tone="root"
                  x={rootX}
                  y={rootY}
                  width={264}
                  canvasWidth={width}
                  canvasHeight={height}
                  active
                  onClick={() => props.onRootSelect(props.rootNode!.id)}
                />
              ) : null}

              {props.branchNodes.map((item, index) => (
                <TreeNodeCard
                  key={item.node.id}
                  id={item.node.id}
                  label={item.node.title}
                  subtitle={item.reason}
                  tone="artifact"
                  x={branchPositions[index]?.x ?? rootX}
                  y={branchPositions[index]?.y ?? 428}
                  width={208}
                  canvasWidth={width}
                  canvasHeight={height}
                  active={props.expandedBranchNodeId === item.node.id}
                  compact
                  onClick={() =>
                    props.expandedBranchNodeId === item.node.id
                      ? props.onBranchAdvance(item.node.id)
                      : props.onBranchSelect(item.node.id)
                  }
                  onAdvance={() => props.onBranchAdvance(item.node.id)}
                  onMouseEnter={() => props.onNodeHover(item.node.id)}
                  onMouseLeave={props.onNodeLeave}
                />
              ))}

              {props.tertiaryNodes.map((item, index) => (
                <TreeNodeCard
                  key={item.node.id}
                  id={item.node.id}
                  label={item.node.title}
                  subtitle={item.reason}
                  tone="accent"
                  x={tertiaryPositions[index]?.x ?? rootX}
                  y={tertiaryPositions[index]?.y ?? tertiaryBaseY}
                  width={190}
                  canvasWidth={width}
                  canvasHeight={height}
                  compact
                  onClick={() => props.onBranchAdvance(item.node.id)}
                  onAdvance={() => props.onBranchAdvance(item.node.id)}
                  onMouseEnter={() => props.onNodeHover(item.node.id)}
                  onMouseLeave={props.onNodeLeave}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeNodeCard(props: TreeCard) {
  const toneClasses: Record<CanvasNodeTone, string> = {
    root: "border-[rgba(52,101,255,0.26)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(231,243,255,0.94))] text-slate-950 shadow-[0_22px_58px_-38px_rgba(52,101,255,0.2)]",
    collection: "border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,255,255,0.96))] text-slate-950 shadow-[0_16px_36px_-28px_rgba(4,12,27,0.14)]",
    smart: "border-[rgba(143,105,255,0.28)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(243,238,255,0.94))] text-slate-950 shadow-[0_20px_46px_-34px_rgba(143,105,255,0.18)]",
    artifact: "border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,255,255,0.96))] text-slate-950 shadow-[0_16px_36px_-28px_rgba(4,12,27,0.14)]",
    accent: "border-[rgba(255,182,224,0.36)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,241,248,0.95))] text-slate-950 shadow-[0_20px_46px_-34px_rgba(255,182,224,0.18)]",
  };

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
      style={{
        left: `${(props.x / props.canvasWidth) * 100}%`,
        top: `${(props.y / props.canvasHeight) * 100}%`,
        width: `${props.width}px`,
        opacity: props.muted ? 0.24 : 1,
      }}
    >
      <div
        className={[
          "group flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3 transition duration-300",
          toneClasses[props.tone],
          props.active ? "ring-2 ring-[rgba(52,101,255,0.24)]" : "",
          props.dotted ? "border-dashed" : "",
          props.compact ? "py-2.5" : "",
          props.onClick ? "cursor-pointer hover:border-slate-400 hover:bg-white" : "",
        ].join(" ")}
        onClick={props.onClick}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
      >
        <div className="min-w-0">
          <div className={["truncate font-medium text-slate-900", props.compact ? "text-[13px] leading-5" : "text-[14px] leading-5"].join(" ")}>
            {props.label}
          </div>
          {props.subtitle ? <div className="mt-0.5 truncate text-xs text-slate-500">{props.subtitle}</div> : null}
        </div>
        {props.onAdvance ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation();
              props.onAdvance?.();
            }}
            aria-label={`Expand ${props.label}`}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CanvasControlButton(props: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-800 shadow-[0_10px_24px_-18px_rgba(4,12,27,0.18)] transition hover:border-slate-400 hover:bg-slate-50"
    >
      {props.children}
    </button>
  );
}

function GraphFilterChip(props: {
  label: string;
  meta: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        props.active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400",
      ].join(" ")}
      onClick={props.onClick}
    >
      <span>{props.label}</span>
      <span className={props.active ? "text-white/70" : "text-slate-400"}>{props.meta}</span>
    </button>
  );
}

function listNeighbors(
  adjacencyMap: Map<string, Neighbor[]>,
  nodeId: string,
  options: { limit: number; excludeIds?: string[] },
) {
  const excluded = new Set(options.excludeIds ?? []);
  return (adjacencyMap.get(nodeId) ?? [])
    .filter((neighbor) => !excluded.has(neighbor.node.id))
    .slice(0, options.limit);
}

function spreadXPositions(
  count: number,
  centerX: number,
  gap: number,
  minX: number,
  maxX: number,
) {
  if (count <= 0) return [];
  const availableWidth = Math.max(0, maxX - minX);
  const adjustedGap = count > 1 ? Math.min(gap, availableWidth / (count - 1)) : gap;
  const totalWidth = (count - 1) * adjustedGap;
  let start = centerX - totalWidth / 2;
  if (start < minX) start = minX;
  if (start + totalWidth > maxX) start = maxX - totalWidth;
  return Array.from({ length: count }, (_, index) => start + index * adjustedGap);
}

function describeCollection(collection: ArtifactGraphCollection) {
  return collection.kind === "folder"
    ? `Saved folder · ${collection.artifactCount} docs`
    : `Suggested cluster · ${collection.artifactCount} docs`;
}

function buildCurvePath(startX: number, startY: number, endX: number, endY: number) {
  const controlOffset = Math.max(90, (endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function layoutTier(input: {
  count: number;
  centerX: number;
  width: number;
  minX: number;
  maxX: number;
  maxPerRow: number;
  baseY: number;
  rowGap: number;
}): Point[] {
  if (input.count <= 0) return [];

  const rows = Math.ceil(input.count / input.maxPerRow);
  const points: Point[] = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const startIndex = rowIndex * input.maxPerRow;
    const rowCount = Math.min(input.maxPerRow, input.count - startIndex);
    const rowGap = input.width + 44;
    const xs = spreadXPositions(rowCount, input.centerX, rowGap, input.minX, input.maxX);

    for (let index = 0; index < rowCount; index += 1) {
      points.push({
        x: xs[index] ?? input.centerX,
        y: input.baseY + rowIndex * input.rowGap,
      });
    }
  }

  return points;
}
