import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MasteryEffect {
  effect: number;
  stats: string[];
  reminderText?: string[];
}

interface TreeNode {
  skill: number;
  name?: string;
  icon?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  isAscendancyStart?: boolean;
  isBloodline?: boolean;
  ascendancyName?: string;
  classStartIndex?: number;
  expansionJewel?: { size: number; index: number; proxy: string; parent: string };
  masteryEffects?: MasteryEffect[];
  group?: number;
  orbit?: number;
  orbitIndex?: number;
  out?: string[];
  in?: string[];
  stats?: string[];
  reminderText?: string[];
  flavourText?: string[];
}

interface TreeGroup {
  x: number;
  y: number;
  orbits: number[];
  nodes: string[];
  isProxy?: boolean;
  background?: { image: string; isHalfImage?: boolean };
}

interface SpriteCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SpriteSheet {
  filename: string;
  w: number;
  h: number;
  coords: Record<string, SpriteCoords>;
}

interface TreeData {
  nodes: Record<string, TreeNode>;
  groups: Record<string, TreeGroup>;
  constants: {
    orbitRadii: number[];
    skillsPerOrbit: number[];
  };
  sprites: {
    normalActive: Record<string, SpriteSheet>;
    notableActive: Record<string, SpriteSheet>;
    keystoneActive: Record<string, SpriteSheet>;
    normalInactive: Record<string, SpriteSheet>;
    notableInactive: Record<string, SpriteSheet>;
    keystoneInactive: Record<string, SpriteSheet>;
    mastery: Record<string, SpriteSheet>;
    masteryConnected: Record<string, SpriteSheet>;
    frame: Record<string, SpriteSheet>;
    jewel: Record<string, SpriteSheet>;
    groupBackground: Record<string, SpriteSheet>;
  };
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  classes: Array<{
    name: string;
    ascendancies: Array<{ id: string; name: string }>;
  }>;
}

interface PassiveTreeProps {
  allocatedNodes?: number[];
  masterySelections?: Record<string, number>;  // nodeId -> selected effect ID
  characterClass?: string;
  ascendancy?: string;
  width?: number;
  height?: number;
}

interface CalculatedNode {
  id: string;
  node: TreeNode;
  x: number;
  y: number;
}

// Class start node positions (approximate centers for each class)
const CLASS_START_POSITIONS: Record<string, { x: number; y: number }> = {
  'Scion': { x: 0, y: 0 },
  'Marauder': { x: -10500, y: 5200 },
  'Ranger': { x: 10500, y: 5200 },
  'Witch': { x: 0, y: -9500 },
  'Duelist': { x: 10500, y: 9500 },
  'Templar': { x: -10500, y: -5200 },
  'Shadow': { x: 10500, y: -5200 },
};

// Map display names to internal ascendancy IDs in the tree data
// POE API returns display names, but tree data uses internal IDs
const ASCENDANCY_NAME_MAP: Record<string, string> = {
  // Ranger ascendancies (POE2 renamed Raider to Warden)
  'Warden': 'Raider',
  'Deadeye': 'Deadeye',
  'Pathfinder': 'Pathfinder',
  // Witch
  'Elementalist': 'Elementalist',
  'Necromancer': 'Necromancer',
  'Occultist': 'Occultist',
  // Shadow
  'Assassin': 'Assassin',
  'Saboteur': 'Saboteur',
  'Trickster': 'Trickster',
  // Marauder
  'Juggernaut': 'Juggernaut',
  'Berserker': 'Berserker',
  'Chieftain': 'Chieftain',
  // Duelist
  'Slayer': 'Slayer',
  'Gladiator': 'Gladiator',
  'Champion': 'Champion',
  // Templar
  'Inquisitor': 'Inquisitor',
  'Hierophant': 'Hierophant',
  'Guardian': 'Guardian',
  // Scion
  'Ascendant': 'Ascendant',
};

// Orbit angles - some orbits have non-uniform spacing
const ORBIT_ANGLES: Record<number, number[]> = {
  16: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330].map(d => (d * Math.PI) / 180),
  40: [0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170,
       180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350].map(d => (d * Math.PI) / 180),
};

function getOrbitAngles(nodesInOrbit: number): number[] {
  if (ORBIT_ANGLES[nodesInOrbit]) {
    return ORBIT_ANGLES[nodesInOrbit];
  }
  return Array.from({ length: nodesInOrbit }, (_, i) => (2 * Math.PI * i) / nodesInOrbit);
}

function calculateNodePosition(
  node: TreeNode,
  group: TreeGroup,
  constants: TreeData['constants']
): { x: number; y: number } {
  if (node.orbit === undefined || node.orbitIndex === undefined) {
    return { x: group.x, y: group.y };
  }

  const radius = constants.orbitRadii[node.orbit] || 0;
  const nodesInOrbit = constants.skillsPerOrbit[node.orbit] || 1;
  const angles = getOrbitAngles(nodesInOrbit);
  const angle = angles[node.orbitIndex] || 0;

  return {
    x: group.x + Math.sin(angle) * radius,
    y: group.y - Math.cos(angle) * radius,
  };
}

// Image cache for sprites
const imageCache = new Map<string, HTMLImageElement>();

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  // Proxy poecdn.com URLs through Rust backend to bypass CORS
  let imageUrl = url;
  if (url.includes('poecdn.com')) {
    try {
      imageUrl = await invoke<string>('proxy_image', { url });
    } catch (err) {
      console.warn('Failed to proxy image, falling back to direct load:', err);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

export function PassiveTree({
  allocatedNodes = [],
  masterySelections = {},
  characterClass,
  ascendancy,
  width = 800,
  height = 600
}: PassiveTreeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingSprites, setLoadingSprites] = useState(false);
  const [spritesLoaded, setSpritesLoaded] = useState(false);

  // Pan and zoom state
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.05);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hover state
  const [hoveredNode, setHoveredNode] = useState<CalculatedNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Cached calculated positions
  const [nodePositions, setNodePositions] = useState<Map<string, CalculatedNode>>(new Map());

  // Get internal ascendancy name from display name
  const internalAscendancy = ascendancy ? (ASCENDANCY_NAME_MAP[ascendancy] || ascendancy) : undefined;

  // Center on class start
  const centerOnClass = useCallback((className?: string) => {
    const startPos = CLASS_START_POSITIONS[className || ''] || { x: 0, y: 0 };
    setOffset({ x: -startPos.x, y: -startPos.y });
    setZoom(0.08);
  }, []);

  // Center on character's ascendancy (find average position of ascendancy nodes)
  const centerOnAscendancy = useCallback(() => {
    if (!treeData || !internalAscendancy) return;

    const ascNodes = Object.values(treeData.nodes).filter(n =>
      n.ascendancyName === internalAscendancy
    );
    if (ascNodes.length === 0) return;

    let sumX = 0, sumY = 0, count = 0;
    for (const node of ascNodes) {
      if (node.group === undefined) continue;
      const group = treeData.groups[node.group];
      if (!group) continue;
      const pos = calculateNodePosition(node, group, treeData.constants);
      sumX += pos.x;
      sumY += pos.y;
      count++;
    }

    if (count > 0) {
      setOffset({ x: -sumX / count, y: -sumY / count });
      setZoom(0.12);
    }
  }, [treeData, internalAscendancy]);

  // Load tree data
  useEffect(() => {
    async function loadTree() {
      try {
        const response = await fetch('/tree-data.json');
        if (!response.ok) throw new Error('Failed to load tree data');
        const data = await response.json();
        setTreeData(data);

        // Center on character's class start, or tree center if no class
        if (characterClass) {
          centerOnClass(characterClass);
        } else {
          const centerX = (data.min_x + data.max_x) / 2;
          const centerY = (data.min_y + data.max_y) / 2;
          setOffset({ x: -centerX, y: -centerY });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tree');
      } finally {
        setLoading(false);
      }
    }
    loadTree();
  }, [characterClass, centerOnClass]);

  // Calculate node positions when tree data loads
  useEffect(() => {
    if (!treeData) return;

    const positions = new Map<string, CalculatedNode>();
    for (const [nodeId, node] of Object.entries(treeData.nodes)) {
      if (node.group === undefined) continue;
      const group = treeData.groups[node.group];
      if (!group) continue;

      // Skip cluster jewel expansion nodes (they only appear when jewel is socketed)
      if (node.expansionJewel) continue;

      // Include all other nodes - main tree, all ascendancies, and all bloodlines
      const pos = calculateNodePosition(node, group, treeData.constants);
      positions.set(nodeId, { id: nodeId, node, ...pos });
    }
    setNodePositions(positions);
  }, [treeData]);

  // Load sprite sheets for better quality rendering
  useEffect(() => {
    if (!treeData || spritesLoaded || loadingSprites) return;

    async function loadSprites() {
      setLoadingSprites(true);
      try {
        // Get the highest resolution sprite sheets (0.3835 zoom level)
        const zoomLevel = '0.3835';
        const spriteTypes = [
          'normalActive', 'notableActive', 'keystoneActive',
          'normalInactive', 'notableInactive', 'keystoneInactive',
          'mastery', 'jewel'
        ] as const;

        const loadPromises: Promise<HTMLImageElement>[] = [];
        for (const type of spriteTypes) {
          const spriteData = treeData!.sprites[type as keyof TreeData['sprites']];
          if (spriteData && typeof spriteData === 'object') {
            const sheet = (spriteData as Record<string, SpriteSheet>)[zoomLevel];
            if (sheet?.filename) {
              loadPromises.push(loadImage(sheet.filename));
            }
          }
        }
        await Promise.all(loadPromises);
        setSpritesLoaded(true);
      } catch (err) {
        console.warn('Failed to load some sprites:', err);
        // Continue without sprites
        setSpritesLoaded(true);
      } finally {
        setLoadingSprites(false);
      }
    }
    loadSprites();
  }, [treeData, spritesLoaded, loadingSprites]);

  // Get sprite info for a node
  const getSpriteInfo = useCallback((node: TreeNode, isAllocated: boolean): {
    sheet: SpriteSheet;
    coords: SpriteCoords;
    image: HTMLImageElement;
  } | null => {
    if (!treeData || !spritesLoaded) return null;

    const zoomLevel = '0.3835';
    let spriteType: string;

    if (node.isKeystone) {
      spriteType = isAllocated ? 'keystoneActive' : 'keystoneInactive';
    } else if (node.isNotable) {
      spriteType = isAllocated ? 'notableActive' : 'notableInactive';
    } else if (node.isMastery) {
      spriteType = 'mastery';
    } else if (node.isJewelSocket) {
      spriteType = 'jewel';
    } else {
      spriteType = isAllocated ? 'normalActive' : 'normalInactive';
    }

    const spriteData = treeData.sprites[spriteType as keyof typeof treeData.sprites];
    if (!spriteData || typeof spriteData !== 'object') return null;

    const sheet = (spriteData as Record<string, SpriteSheet>)[zoomLevel];
    if (!sheet || !node.icon) return null;

    const coords = sheet.coords[node.icon];
    if (!coords) return null;

    const image = imageCache.get(sheet.filename);
    if (!image) return null;

    return { sheet, coords, image };
  }, [treeData, spritesLoaded]);

  // Convert screen coordinates to tree coordinates
  const screenToTree = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - width / 2) / zoom - offset.x,
      y: (screenY - height / 2) / zoom - offset.y,
    };
  }, [width, height, zoom, offset]);

  // Find node at position
  const findNodeAt = useCallback((treeX: number, treeY: number): CalculatedNode | null => {
    const hitRadius = 50 / zoom; // Adjust hit area based on zoom

    for (const calcNode of nodePositions.values()) {
      const dx = calcNode.x - treeX;
      const dy = calcNode.y - treeY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let nodeRadius = 25;
      if (calcNode.node.isKeystone) nodeRadius = 60;
      else if (calcNode.node.isNotable) nodeRadius = 40;
      else if (calcNode.node.isMastery) nodeRadius = 50;
      else if (calcNode.node.isJewelSocket) nodeRadius = 45;

      if (dist < nodeRadius + hitRadius) {
        return calcNode;
      }
    }
    return null;
  }, [nodePositions, zoom]);

  // Render tree
  useEffect(() => {
    if (!treeData || !canvasRef.current || nodePositions.size === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with dark background
    ctx.fillStyle = '#080810';
    ctx.fillRect(0, 0, width, height);

    // Transform: center canvas, apply zoom and pan
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(offset.x, offset.y);

    const allocatedSet = new Set(allocatedNodes);

    // Find the ascendancy start node for the character's ascendancy (it's free)
    let ascStartNodeId: number | null = null;
    if (internalAscendancy) {
      for (const [, node] of Object.entries(treeData.nodes)) {
        if (node.isAscendancyStart && node.ascendancyName === internalAscendancy) {
          ascStartNodeId = node.skill;
          break;
        }
      }
    }

    // Helper to check if a mastery is allocated (node ID is in masterySelections)
    const isMasteryAllocated = (node: TreeNode): boolean => {
      if (!node.isMastery) return false;
      return String(node.skill) in masterySelections;
    };

    // Draw connections first (below nodes)
    ctx.lineCap = 'round';

    for (const calcNode of nodePositions.values()) {
      const { node } = calcNode;
      if (!node.out) continue;

      for (const outId of node.out) {
        const outCalc = nodePositions.get(outId);
        if (!outCalc) continue;

        // Skip connections TO or FROM mastery nodes (they don't have visual edges)
        if (node.isMastery || outCalc.node.isMastery) continue;

        // Skip connections between different ascendancies (but allow main tree to ascendancy start)
        const nodeAsc = node.ascendancyName;
        const outAsc = outCalc.node.ascendancyName;

        if (nodeAsc !== outAsc) {
          // Allow connection from main tree to any ascendancy start
          const isToAscStart = !nodeAsc && outCalc.node.isAscendancyStart;
          const isFromAscStart = node.isAscendancyStart && !outAsc;
          if (!isToAscStart && !isFromAscStart) continue;
        }

        // Skip very long connections (likely cross-tree references)
        const dx = outCalc.x - calcNode.x;
        const dy = outCalc.y - calcNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2500) continue; // Max reasonable connection length

        // Check if this connection is between allocated nodes (include free ascendancy start)
        const nodeAllocated = allocatedSet.has(node.skill) || node.skill === ascStartNodeId;
        const outAllocated = allocatedSet.has(outCalc.node.skill) || outCalc.node.skill === ascStartNodeId;
        const isAllocated = nodeAllocated && outAllocated;

        // Connection style based on allocation state
        if (isAllocated) {
          ctx.strokeStyle = '#c9aa58';
          ctx.lineWidth = 12;
        } else {
          ctx.strokeStyle = '#2a2a3a';
          ctx.lineWidth = 8;
        }

        ctx.beginPath();
        ctx.moveTo(calcNode.x, calcNode.y);
        ctx.lineTo(outCalc.x, outCalc.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const calcNode of nodePositions.values()) {
      const { node, x, y } = calcNode;

      // Skip certain node types
      if (node.isAscendancyStart && !node.ascendancyName) continue;
      if (node.classStartIndex !== undefined && !allocatedSet.has(node.skill)) continue;

      // Check if allocated (regular node, ascendancy start, or mastery with selected effect)
      const isAllocated = allocatedSet.has(node.skill) ||
        node.skill === ascStartNodeId ||
        isMasteryAllocated(node);

      // Determine node appearance
      let radius = 25;
      let fillColor = '#1a1a2a';
      let strokeColor = '#3a3a5a';
      let strokeWidth = 3;
      let innerRadius = 0;
      let innerColor = '';

      if (node.isKeystone) {
        radius = 55;
        fillColor = isAllocated ? '#2a2a1a' : '#0a0a15';
        strokeColor = isAllocated ? '#d4af37' : '#5a4a2a';
        strokeWidth = 4;
        innerRadius = 40;
        innerColor = isAllocated ? '#c9aa58' : '#3a3a4a';
      } else if (node.isNotable) {
        radius = 38;
        fillColor = isAllocated ? '#2a2a1a' : '#0f0f1a';
        strokeColor = isAllocated ? '#c9aa58' : '#4a4a6a';
        strokeWidth = 3;
        innerRadius = 28;
        innerColor = isAllocated ? '#a88b4a' : '#2a2a3a';
      } else if (node.isMastery) {
        radius = 45;
        fillColor = isAllocated ? '#1a1a2a' : '#0a0a15';
        strokeColor = isAllocated ? '#c9aa58' : '#4a4a6a';
        strokeWidth = isAllocated ? 3 : 2;
      } else if (node.isJewelSocket) {
        radius = 40;
        fillColor = isAllocated ? '#1a2a2a' : '#0a1515';
        strokeColor = isAllocated ? '#4ac9c9' : '#2a5a5a';
        strokeWidth = 3;
      } else if (node.classStartIndex !== undefined) {
        radius = 70;
        fillColor = '#1a1020';
        strokeColor = '#6a4a8a';
        strokeWidth = 4;
      } else {
        // Regular small node
        radius = 25;
        fillColor = isAllocated ? '#2a2a1a' : '#12121a';
        strokeColor = isAllocated ? '#a88b4a' : '#3a3a5a';
        strokeWidth = 2;
      }

      // Draw outer glow for allocated nodes
      if (isAllocated) {
        const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.5);
        gradient.addColorStop(0, 'rgba(201, 170, 88, 0.3)');
        gradient.addColorStop(1, 'rgba(201, 170, 88, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Try to draw sprite icon
      const spriteInfo = getSpriteInfo(node, isAllocated);
      if (spriteInfo) {
        const { coords, image } = spriteInfo;
        // Scale the sprite to fit the node
        const scale = (radius * 2.2) / Math.max(coords.w, coords.h);
        const drawW = coords.w * scale;
        const drawH = coords.h * scale;

        // Clip to circle for all nodes except jewels (which are diamonds)
        if (!node.isJewelSocket) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, radius * 1.1, 0, Math.PI * 2);
          ctx.clip();
        }

        ctx.drawImage(
          image,
          coords.x, coords.y, coords.w, coords.h,
          x - drawW / 2, y - drawH / 2, drawW, drawH
        );

        if (!node.isJewelSocket) {
          ctx.restore();
        }
        continue;
      }

      // Fallback: Draw jewel socket as diamond
      if (node.isJewelSocket) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = fillColor;
        ctx.fillRect(-radius * 0.6, -radius * 0.6, radius * 1.2, radius * 1.2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(-radius * 0.6, -radius * 0.6, radius * 1.2, radius * 1.2);
        ctx.restore();
        continue;
      }

      // Fallback: Draw main node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Draw inner ring for notables/keystones
      if (innerRadius > 0) {
        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = innerColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw small center dot for allocated nodes
      if (isAllocated && !node.isKeystone && !node.isNotable && !node.isMastery) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#c9aa58';
        ctx.fill();
      }
    }

    // Draw hover highlight
    if (hoveredNode) {
      const { x, y, node } = hoveredNode;
      let radius = 30;
      if (node.isKeystone) radius = 60;
      else if (node.isNotable) radius = 43;
      else if (node.isMastery) radius = 50;
      else if (node.isJewelSocket) radius = 45;

      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();

  }, [treeData, width, height, offset, zoom, allocatedNodes, masterySelections, nodePositions, hoveredNode, getSpriteInfo, internalAscendancy]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isDragging) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      setHoveredNode(null);
    } else {
      // Check for hover
      const treePos = screenToTree(screenX, screenY);
      const node = findNodeAt(treePos.x, treePos.y);
      setHoveredNode(node);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredNode(null);
  };

  // Wheel handler needs to be attached with passive: false to prevent scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Get tree position under mouse before zoom
      const treePosBeforeX = (mouseX - width / 2) / zoom - offset.x;
      const treePosBeforeY = (mouseY - height / 2) / zoom - offset.y;

      // Apply zoom
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(0.5, Math.max(0.015, zoom * zoomFactor));

      // Adjust offset to keep mouse position stable
      const treePosAfterX = (mouseX - width / 2) / newZoom - offset.x;
      const treePosAfterY = (mouseY - height / 2) / newZoom - offset.y;

      setZoom(newZoom);
      setOffset(prev => ({
        x: prev.x + (treePosAfterX - treePosBeforeX),
        y: prev.y + (treePosAfterY - treePosBeforeY),
      }));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [width, height, zoom, offset]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#6a6a8a]">
        Loading tree data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        {error}
      </div>
    );
  }

  const allocatedCount = allocatedNodes.length;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-[#080810] rounded-lg cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Stats overlay */}
      <div className="absolute top-2 left-2 text-xs text-[#6a6a8a] bg-[#0a0a14]/80 px-2 py-1 rounded">
        {allocatedCount} points allocated
        {loadingSprites && <span className="ml-2 text-[#c9aa58]">Loading icons...</span>}
      </div>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={() => setZoom(z => Math.min(0.5, z * 1.2))}
          className="w-6 h-6 bg-[#1a1a2a] text-[#6a6a8a] rounded hover:bg-[#2a2a3a] text-sm"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.015, z / 1.2))}
          className="w-6 h-6 bg-[#1a1a2a] text-[#6a6a8a] rounded hover:bg-[#2a2a3a] text-sm"
          title="Zoom out"
        >
          -
        </button>
        {characterClass && (
          <button
            onClick={() => centerOnClass(characterClass)}
            className="px-2 h-6 bg-[#1a1a2a] text-[#6a6a8a] rounded hover:bg-[#2a2a3a] text-xs"
            title={`Go to ${characterClass} start`}
          >
            Start
          </button>
        )}
        {ascendancy && (
          <button
            onClick={centerOnAscendancy}
            className="px-2 h-6 bg-[#1a1a2a] text-[#6a6a8a] rounded hover:bg-[#2a2a3a] text-xs"
            title={`Go to ${ascendancy} ascendancy`}
          >
            Asc
          </button>
        )}
        <button
          onClick={() => {
            if (treeData) {
              const centerX = (treeData.min_x + treeData.max_x) / 2;
              const centerY = (treeData.min_y + treeData.max_y) / 2;
              setOffset({ x: -centerX, y: -centerY });
              setZoom(0.035);
            }
          }}
          className="px-2 h-6 bg-[#1a1a2a] text-[#6a6a8a] rounded hover:bg-[#2a2a3a] text-xs"
          title="Show full tree"
        >
          Full
        </button>
      </div>

      {/* Tooltip */}
      {hoveredNode && !isDragging && (() => {
        const node = hoveredNode.node;
        const selectedEffectId = masterySelections[String(node.skill)];
        const selectedEffect = node.isMastery && node.masteryEffects && selectedEffectId !== undefined
          ? node.masteryEffects.find(e => e.effect === selectedEffectId)
          : null;

        return (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: mousePos.x - (canvasRef.current?.getBoundingClientRect().left || 0) + 15,
              top: mousePos.y - (canvasRef.current?.getBoundingClientRect().top || 0) + 15,
              maxWidth: 300,
            }}
          >
            <div className="bg-[#0a0a14] border border-[#3a3a5a] rounded-lg p-3 shadow-xl">
              <div className="font-medium text-[#c9aa58] mb-1">
                {node.name || 'Unknown Node'}
              </div>
              {/* Show selected mastery effect if allocated */}
              {selectedEffect && (
                <div className="text-xs text-[#8a8aaa] space-y-0.5 mb-2">
                  <div className="text-[#c9aa58] text-xs mb-1">Selected:</div>
                  {selectedEffect.stats.map((stat, i) => (
                    <div key={i}>{stat}</div>
                  ))}
                </div>
              )}
              {/* Show regular stats for non-mastery nodes */}
              {!node.isMastery && node.stats && node.stats.length > 0 && (
                <div className="text-xs text-[#8a8aaa] space-y-0.5">
                  {node.stats.map((stat, i) => (
                    <div key={i}>{stat}</div>
                  ))}
                </div>
              )}
              {/* Show all available mastery options if not allocated */}
              {node.isMastery && !selectedEffect && node.masteryEffects && (
                <div className="text-xs text-[#6a6a8a] space-y-1">
                  <div className="text-[#5a5a7a]">Available options:</div>
                  {node.masteryEffects.slice(0, 3).map((effect, i) => (
                    <div key={i} className="pl-2">• {effect.stats[0]}</div>
                  ))}
                  {node.masteryEffects.length > 3 && (
                    <div className="pl-2 text-[#4a4a6a]">...and {node.masteryEffects.length - 3} more</div>
                  )}
                </div>
              )}
              {node.reminderText && (
                <div className="text-xs text-[#6a6a8a] mt-2 italic">
                  {node.reminderText.join(' ')}
                </div>
              )}
              {node.isKeystone && (
                <div className="text-xs text-[#d4af37] mt-1">Keystone</div>
              )}
              {node.isNotable && (
                <div className="text-xs text-[#a88b4a] mt-1">Notable</div>
              )}
              {node.isMastery && (
                <div className="text-xs text-[#7a5aaa] mt-1">Mastery</div>
              )}
              {node.isJewelSocket && (
                <div className="text-xs text-[#4ac9c9] mt-1">Jewel Socket</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Help text */}
      <div className="absolute bottom-2 right-2 text-xs text-[#4a4a6a]">
        Scroll to zoom • Drag to pan
      </div>
    </div>
  );
}
