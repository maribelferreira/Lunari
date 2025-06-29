import React from 'react';
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

interface DashedCircleProps {
  size: number;
  strokeWidth?: number;
  strokeColor?: string;
  dashLength?: number;
  dashCount?: number;
}

export const DashedCircle: React.FC<DashedCircleProps> = ({
  size,
  strokeWidth = 3,
  strokeColor = '#B8D0FF',
  dashLength = 3,
  dashCount = 120,
}) => {
  const center = size / 2;
  const radius = center - dashLength - 10;
  
  const dashes = [];
  for (let i = 0; i < dashCount; i++) {
    const angle = (i * 360) / dashCount;
    const radian = (angle * Math.PI) / 180;
    
    const startX = center + Math.cos(radian) * radius;
    const startY = center + Math.sin(radian) * radius;
    const endX = center + Math.cos(radian) * (radius + dashLength);
    const endY = center + Math.sin(radian) * (radius + dashLength);
    
    dashes.push(
      <Line
        key={i}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    );
  }
  
  return (
    <View style={{ position: 'absolute', width: size, height: size }}>
      <Svg width={size} height={size}>
        {dashes}
      </Svg>
    </View>
  );
}; 