"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { AssetInstance } from '@/store/sceneStore';
import * as THREE from 'three';

interface Scene3DProps {
  assets: AssetInstance[];
  width: number;
  height: number;
}

// 3D Wall Component
function Wall3D({ asset }: { asset: AssetInstance }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Convert wall nodes to 3D geometry
  const geometry = useMemo(() => {
    if (!asset.wallNodes || !asset.wallEdges || asset.wallEdges.length === 0) {
      return null;
    }

    // Create wall segments from nodes and edges
    const segments: THREE.Vector3[] = [];
    asset.wallEdges.forEach(edge => {
      const start = asset.wallNodes![edge.a];
      const end = asset.wallNodes![edge.b];
      
      // Convert mm coordinates to 3D space (scale down for better viewing)
      const scale = 0.01; // Convert mm to meters
      segments.push(
        new THREE.Vector3(start.x * scale, 0, start.y * scale),
        new THREE.Vector3(end.x * scale, 0, end.y * scale)
      );
    });

    if (segments.length === 0) return null;

    // Create wall geometry by extruding along the path
    const wallHeight = 2.5; // 2.5 meters height
    const wallThickness = (asset.wallThickness || 2) * 0.01; // Convert mm to meters
    
    // For now, create simple box geometry for each wall segment
    const geometries: THREE.BufferGeometry[] = [];
    
    for (let i = 0; i < segments.length; i += 2) {
      const start = segments[i];
      const end = segments[i + 1];
      
      if (!start || !end) continue;
      
      const length = start.distanceTo(end);
      
      const boxGeometry = new THREE.BoxGeometry(length, wallHeight, wallThickness);
      geometries.push(boxGeometry);
    }

    if (geometries.length === 0) return null;
    
    // Merge all geometries into one
    const mergedGeometry = new THREE.BufferGeometry();
    const mergedVertices: number[] = [];
    const mergedNormals: number[] = [];
    const mergedUvs: number[] = [];
    const mergedIndices: number[] = [];
    
    let vertexOffset = 0;
    
    geometries.forEach(geometry => {
      const vertices = geometry.attributes.position.array;
      const normals = geometry.attributes.normal.array;
      const uvs = geometry.attributes.uv.array;
      const indices = geometry.index?.array || [];
      
      // Add vertices
      for (let i = 0; i < vertices.length; i++) {
        mergedVertices.push(vertices[i]);
      }
      
      // Add normals
      for (let i = 0; i < normals.length; i++) {
        mergedNormals.push(normals[i]);
      }
      
      // Add UVs
      for (let i = 0; i < uvs.length; i++) {
        mergedUvs.push(uvs[i]);
      }
      
      // Add indices with offset
      for (let i = 0; i < indices.length; i++) {
        mergedIndices.push(indices[i] + vertexOffset);
      }
      
      vertexOffset += vertices.length / 3;
    });
    
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(mergedVertices, 3));
    mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(mergedNormals, 3));
    mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(mergedUvs, 2));
    mergedGeometry.setIndex(mergedIndices);
    
    return mergedGeometry;
  }, [asset]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, 1.25, 0]}>
      <meshStandardMaterial color="#8B7355" />
    </mesh>
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
    
    return new THREE.BoxGeometry(width, depth, height);
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

// Main 3D Scene Component
export default function Scene3D({ assets, width, height }: Scene3DProps) {
  return (
    <div style={{ width, height }}>
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        style={{ background: '#f0f0f0' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        
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
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        
        {/* Render assets */}
        {assets.map((asset) => {
          if (asset.type === 'wall-segments') {
            return <Wall3D key={asset.id} asset={asset} />;
          } else if (asset.type === 'square' || asset.type === 'circle' || asset.type === 'line') {
            return <Shape3D key={asset.id} asset={asset} />;
          }
          return null;
        })}
        
        {/* Camera controls */}
        <OrbitControls 
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
