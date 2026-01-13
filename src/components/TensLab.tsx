"use client";

import React from 'react';
import { useState, useEffect } from 'react';

const TensLab = () => {
  const [width, setWidth] = useState(window.innerWidth);
  const [isMobile, setIsMobile] = useState(width <= 768);

  useEffect(() => {
    window.addEventListener('resize', () => {
      setWidth(window.innerWidth);
      setIsMobile(window.innerWidth <= 768);
    });
  }, []);

  return (
    <div className="flex flex-col md:flex-row">
      {/* Componente à esquerda */}
      <div
        className={`w-full md:w-1/2 p-4 bg-gray-200 rounded-lg overflow-hidden ${
          isMobile ? 'md:hidden' : ''
        }`}
      >
        {/* Conteúdo do componente à esquerda */}
      </div>

      {/* Componente à direita */}
      <div
        className={`w-full md:w-1/2 p-4 bg-gray-200 rounded-lg overflow-hidden relative ${
          isMobile ? 'md:block' : ''
        }`}
      >
        {/* Conteúdo do componente à direita */}
      </div>
    </div>
  );
};

export default TensLab;