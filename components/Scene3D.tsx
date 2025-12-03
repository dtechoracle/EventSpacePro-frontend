"use client";

import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { AssetInstance } from '@/store/sceneStore';
import * as THREE from 'three';
// import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader'; // Removed because can't resolve module
import { ASSET_LIBRARY } from '@/lib/assets';

interface Scene3DProps {
  assets: AssetInstance[];
  width: number;
  height: number;
}

// 3D Wall Component (one box per wall edge, positioned and rotated)
function Wall3D({ asset }: { asset: AssetInstance }) {
  const scale = 0.01; // mm -> meters
  const wallHeight = 0.6; // meters - reduced for low miniature view
  const wallThickness = ((asset.wallGap ?? 8)) * scale; // use visual gap as physical thickness

  // Support both node-edge and plain segments
  const edges = useMemo(() => {
    if (asset.wallNodes && asset.wallEdges && asset.wallEdges.length > 0) {
      return asset.wallEdges.map((e) => ({
        a: asset.wallNodes![e.a],
        b: asset.wallNodes![e.b],
      }));
    }
    if (asset.wallSegments && asset.wallSegments.length > 0) {
      return asset.wallSegments.map((s) => ({
        a: { x: s.start.x + asset.x, y: s.start.y + asset.y },
        b: { x: s.end.x + asset.x, y: s.end.y + asset.y },
      }));
    }
    return [] as { a: { x: number; y: number }; b: { x: number; y: number } }[];
  }, [asset]);

  if (!edges.length) return null;

  return (
    <group>
      {edges.map((edge, idx) => {
        const dx = (edge.b.x - edge.a.x) * scale;
        const dz = (edge.b.y - edge.a.y) * scale; // y in 2D maps to z in 3D
        const length = Math.hypot(dx, dz);
        if (length <= 0.0001) return null;
        const angleY = Math.atan2(dz, dx);
        const midX = (edge.a.x + edge.b.x) * 0.5 * scale;
        const midZ = (edge.a.y + edge.b.y) * 0.5 * scale;
        return (
          <mesh key={idx} position={[midX, wallHeight / 2, midZ]} rotation={[0, angleY, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, wallHeight, wallThickness]} />
            <meshStandardMaterial color="#e5e7eb" />
    </mesh>
        );
      })}
    </group>
  );
}

// 3D Shape Component
function Shape3D({ asset }: { asset: AssetInstance }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const scale = 0.01; // Convert mm to meters
    const width = (asset.width || 50) * scale;
    const height = (asset.height || 50) * scale;
    const depth = 0.1; // 10cm depth for shapes
    
    if (asset.type === 'square') {
      return new THREE.BoxGeometry(width, depth, height);
    } else if (asset.type === 'circle') {
      return new THREE.CylinderGeometry(width / 2, width / 2, depth, 16);
    } else if (asset.type === 'line') {
      const length = asset.width || 100;
      return new THREE.BoxGeometry(length * scale, 0.05, 0.05);
    }
    
    // Fallback: thin box using width/height when available
    return new THREE.BoxGeometry(width || 0.5, depth, height || 0.5);
  }, [asset]);

  const position = useMemo(() => {
    const scale = 0.01;
    return [
      (asset.x || 0) * scale,
      0.05, // Slightly above ground
      (asset.y || 0) * scale
    ] as [number, number, number];
  }, [asset]);

  const rotation = useMemo(() => {
    return [0, (asset.rotation || 0) * Math.PI / 180, 0] as [number, number, number];
  }, [asset]);

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      position={position}
      rotation={rotation}
    >
      <meshStandardMaterial color={asset.backgroundColor || "#f3f4f6"} />
    </mesh>
  );
}

// Very simple chair representation (seat cylinder + back box)
function Chair3D({ asset }: { asset: AssetInstance }) {
  const scale = 0.01;
  const seatR = Math.max(0.1, ((Math.min(asset.width || 400, asset.height || 400) * scale) / 2) * 0.45);
  const seatH = 0.04;
  const backW = seatR * 1.2;
  const backH = 0.35;
  const backT = 0.02;
  const position: [number, number, number] = [
    (asset.x || 0) * scale,
    seatH / 2,
    (asset.y || 0) * scale,
  ];
  const rotation: [number, number, number] = [0, (asset.rotation || 0) * Math.PI / 180, 0];
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[seatR, seatR, seatH, 18]} />
        <meshStandardMaterial color="#d1d5db" />
      </mesh>
      <mesh position={[0, (backH / 2), -seatR * 0.6]} castShadow>
        <boxGeometry args={[backW, backH, backT]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
    </group>
  );
}

// Generic asset renderer in 3D (supports groups)
function AssetsGroup3D({ assets }: { assets: AssetInstance[] }) {
  return (
    <>
      {assets.map((asset) => {
        if (asset.isGroup && asset.groupAssets && asset.groupAssets.length) {
          const scale = 0.01;
          return (
            <group key={asset.id} position={[(asset.x || 0) * scale, 0, (asset.y || 0) * scale]} rotation={[0, (asset.rotation || 0) * Math.PI / 180, 0]}>
              <AssetsGroup3D assets={asset.groupAssets as AssetInstance[]} />
            </group>
          );
        }
        if (asset.type === 'wall-segments') {
          return <Wall3D key={asset.id} asset={asset} />;
        }
        if (asset.type === 'square' || asset.type === 'circle' || asset.type === 'line' || (asset.width && asset.height)) {
          return <Shape3D key={asset.id} asset={asset} />;
        }
        if (asset.type === 'normal-chair') {
          return <Chair3D key={asset.id} asset={asset} />;
        }
        // Custom SVGs: extrude to thin 3D meshes
        const def = ASSET_LIBRARY.find(d => d.id === asset.type);
        if (def && def.isCustom && def.path) {
          // Fallback to simple shape proxy for custom SVGs (viewer-only) to avoid loader issues
          return <Shape3D key={asset.id} asset={asset} />;
        }
        return null;
      })}
    </>
  );
}

// Extrude custom SVG into a thin 3D mesh and scale to asset width/height
// Note: SVG-to-3D extrusion is temporarily disabled due to loader build issues.

// Main 3D Scene Component
export default function Scene3D({ assets, width, height }: Scene3DProps) {
  // Compute scene bounds and center from assets so we can center the view
  const scale = 0.01; // mm -> meters
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pushPoint = (x:number, y:number) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };
    for (const a of assets) {
      if (a.type === 'wall-segments') {
        if (a.wallNodes && a.wallEdges && a.wallNodes.length) {
          a.wallNodes.forEach(n => pushPoint(n.x, n.y));
        } else if (a.wallSegments && a.wallSegments.length) {
          a.wallSegments.forEach(s => { pushPoint(s.start.x + a.x, s.start.y + a.y); pushPoint(s.end.x + a.x, s.end.y + a.y); });
        } else {
          pushPoint(a.x, a.y);
        }
      } else {
        pushPoint(a.x || 0, a.y || 0);
      }
    }
    if (!isFinite(minX)) { minX = -500; maxX = 500; minY = -500; maxY = 500; }
    const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
    const extent = Math.max(maxX - minX, maxY - minY);
    return { cx, cy, extent };
  }, [assets]);

  // Camera distance based on extent (fallback to reasonable default)
  const distance = useMemo(() => {
    const base = Math.max(8, (bounds.extent || 1000) * scale * 1.8);
    return base;
  }, [bounds]);

  return (
    <div style={{ width, height }}>
      <Canvas
        shadows
        camera={{ position: [distance, distance, distance], fov: 50 }}
        style={{ background: '#f0f0f0' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 12, 6]} intensity={0.9} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        
        {/* Grid */}
        <Grid 
          args={[20, 20]} 
          position={[0, 0, 0]} 
          cellSize={1} 
          cellThickness={0.5} 
          cellColor="#cccccc" 
          sectionSize={5} 
          sectionThickness={1} 
          sectionColor="#999999" 
        />
        
        {/* Ground plane */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Render assets */}
        <group position={[-bounds.cx * scale, 0, -bounds.cy * scale]}>
          <AssetsGroup3D assets={assets} />
        </group>
        
        {/* Camera controls */}
        <OrbitControls 
          target={[0, 1.2, 0]}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
        />
      </Canvas>
    </div>
  );
}
