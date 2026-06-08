// src/components/Cape3DViewer.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Cape3DViewerProps {
  capeUrl: string;
  skinUrl?: string;
  width?: number;
  height?: number;
}

export function Cape3DViewer({ capeUrl, skinUrl, width = 400, height = 400 }: Cape3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Сцена
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);
    sceneRef.current = scene;

    // Камера
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(2.5, 1.8, 3.5);
    camera.lookAt(0, 1.2, 0);
    cameraRef.current = camera;

    // Рендерер
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Освещение
    const ambientLight = new THREE.AmbientLight(0x404060);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(2, 5, 3);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const backLight = new THREE.PointLight(0x4466cc, 0.4);
    backLight.position.set(0, 2, -2.5);
    scene.add(backLight);

    const fillLight = new THREE.PointLight(0xffaa66, 0.3);
    fillLight.position.set(1, -1, 1.5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xff6633, 0.5);
    rimLight.position.set(1.5, 1.8, -2);
    scene.add(rimLight);

    // Пол
    const gridHelper = new THREE.GridHelper(6, 20, 0x8888aa, 0x444466);
    gridHelper.position.y = -0.85;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.4;
    scene.add(gridHelper);

    const circleGeometry = new THREE.CircleGeometry(0.8, 16);
    const circleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.3 });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = -0.82;
    scene.add(circle);

    // Группа персонажа
    const character = new THREE.Group();
    characterRef.current = character;

    // Текстура скина (если есть)
    let skinTexture: THREE.Texture | null = null;
    if (skinUrl) {
      skinTexture = new THREE.TextureLoader().load(skinUrl);
    }

    const skinMat = skinTexture 
      ? new THREE.MeshStandardMaterial({ map: skinTexture, roughness: 0.4, metalness: 0.1 })
      : new THREE.MeshStandardMaterial({ color: 0x5d8cae, roughness: 0.4, metalness: 0.1 });

    // Тело
    const bodyGeo = new THREE.BoxGeometry(0.55, 0.85, 0.35);
    const body = new THREE.Mesh(bodyGeo, skinMat);
    body.position.y = 0.2;
    body.castShadow = true;
    character.add(body);

    // Голова
    const headGeo = new THREE.SphereGeometry(0.38, 48, 48);
    const headMat = skinTexture 
      ? new THREE.MeshStandardMaterial({ map: skinTexture, roughness: 0.25 })
      : new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.25 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.85;
    head.castShadow = true;
    character.add(head);

    // Глаза
    const eyeWhiteGeo = new THREE.SphereGeometry(0.08, 24, 24);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    leftEyeWhite.position.set(-0.14, 0.95, 0.4);
    const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    rightEyeWhite.position.set(0.14, 0.95, 0.4);
    character.add(leftEyeWhite);
    character.add(rightEyeWhite);

    const eyePupilGeo = new THREE.SphereGeometry(0.05, 24, 24);
    const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    const leftPupil = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    leftPupil.position.set(-0.14, 0.93, 0.48);
    const rightPupil = new THREE.Mesh(eyePupilGeo, eyePupilMat);
    rightPupil.position.set(0.14, 0.93, 0.48);
    character.add(leftPupil);
    character.add(rightPupil);

    // Ноги
    const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.28);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3d6c8e });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.16, -0.2, 0);
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.16, -0.2, 0);
    rightLeg.castShadow = true;
    character.add(leftLeg);
    character.add(rightLeg);

    // Руки
    const armGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x5d8cae });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.48, 0.55, 0);
    leftArm.castShadow = true;
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.48, 0.55, 0);
    rightArm.castShadow = true;
    character.add(leftArm);
    character.add(rightArm);

    scene.add(character);

    // ПЛАЩ
    if (capeUrl) {
      const capeTexture = new THREE.TextureLoader().load(capeUrl);
      const capeMat = new THREE.MeshStandardMaterial({
        map: capeTexture,
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.35,
        metalness: 0.05,
        emissive: 0x221100,
        emissiveIntensity: 0.1
      });

      const capeMainGeo = new THREE.PlaneGeometry(0.95, 1.15);
      const capeMain = new THREE.Mesh(capeMainGeo, capeMat);
      capeMain.position.set(0, 0.38, -0.32);
      capeMain.castShadow = true;
      character.add(capeMain);

      const capeLowerGeo = new THREE.PlaneGeometry(1.02, 0.85);
      const capeLower = new THREE.Mesh(capeLowerGeo, capeMat);
      capeLower.position.set(0, -0.08, -0.3);
      capeLower.rotation.x = 0.12;
      character.add(capeLower);

      const capeLeftGeo = new THREE.PlaneGeometry(0.4, 1.0);
      const capeLeft = new THREE.Mesh(capeLeftGeo, capeMat);
      capeLeft.position.set(-0.52, 0.38, -0.2);
      capeLeft.rotation.z = 0.08;
      capeLeft.rotation.y = -0.25;
      character.add(capeLeft);

      const capeRightGeo = new THREE.PlaneGeometry(0.4, 1.0);
      const capeRight = new THREE.Mesh(capeRightGeo, capeMat);
      capeRight.position.set(0.52, 0.38, -0.2);
      capeRight.rotation.z = -0.08;
      capeRight.rotation.y = 0.25;
      character.add(capeRight);

      const capeShoulderGeo = new THREE.PlaneGeometry(0.7, 0.38);
      const capeShoulder = new THREE.Mesh(capeShoulderGeo, capeMat);
      capeShoulder.position.set(0, 0.75, -0.32);
      capeShoulder.rotation.x = 0.08;
      character.add(capeShoulder);
    }

    // Управление вращением
    let isDragging = false;
    let lastX = 0;
    let rotationY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      renderer.domElement.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - lastX;
      rotationY += deltaX * 0.008;
      character.rotation.y = rotationY;
      lastX = e.clientX;
    };

    const onMouseUp = () => {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.style.cursor = 'grab';

    // Анимация
    let time = 0;
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      time += 0.025;
      
      const sway = Math.sin(time) * 0.025;
      const capeLower = character.children.find(c => c.position.y === -0.08);
      const capeLeft = character.children.find(c => c.position.x === -0.52);
      const capeRight = character.children.find(c => c.position.x === 0.52);
      const leftArmMesh = character.children.find(c => c.position.x === -0.48);
      const rightArmMesh = character.children.find(c => c.position.x === 0.48);
      
      if (capeLower) capeLower.rotation.z = sway * 0.6;
      if (capeLeft) capeLeft.rotation.z = 0.08 + sway;
      if (capeRight) capeRight.rotation.z = -0.08 - sway;
      if (leftArmMesh) leftArmMesh.rotation.z = Math.sin(time * 1.5) * 0.05;
      if (rightArmMesh) rightArmMesh.rotation.z = -Math.sin(time * 1.5) * 0.05;
      
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [capeUrl, skinUrl, width, height]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width, 
        height, 
        borderRadius: 12, 
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }} 
    />
  );
}