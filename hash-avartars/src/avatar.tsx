import { Svg } from '@47ng/chakra-next'
import {
  BoxProps,
  Flex,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  useColorModeValue,
  useToken
} from '@chakra-ui/react'
import React from 'react'

export async function sha256(message: string) {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(message)

  // hash the message
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  // convert bytes to hex string
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export type Variants = 'normal' | 'stagger' | 'spider' | 'flower' | 'gem'

export type ColorMapper = (args: {
  value: number // [0; 2 ^ bitCount - 1]
  bitCount: number
  hashSoul: number // [0-1]
  circleSoul: number // [0-1]
}) => string

export interface SHA256AvatarProps extends BoxProps {
  radiusFactor?: number
  hash?: string
  showGrid?: boolean
  showLabels?: boolean
  showSections?: boolean
  mapColor?: ColorMapper
  variant?: Variants
}

interface Point {
  x: number
  y: number
}

function polarPoint(radius: number, angle: number): Point {
  // Angle is expressed as [0,1[
  // -Pi/2 to start at noon and go clockwise
  // Trigonometric rotation + inverted Y = clockwise rotation, nifty!
  return {
    x: radius * Math.cos(2 * Math.PI * angle - Math.PI / 2),
    y: radius * Math.sin(2 * Math.PI * angle - Math.PI / 2)
  }
}

function moveTo({ x, y }: Point) {
  return `M ${x} ${y}`
}

function lineTo({ x, y }: Point) {
  return `L ${x} ${y}`
}

function arcTo({ x, y }: Point, radius: number, invert = false) {
  return `A ${radius} ${radius} 0 0 ${invert ? 0 : 1} ${x} ${y}`
}

interface GenerateSectionArgs {
  value: string
  index: number
  outerRadius: number
  innerRadius: number
  horcrux: number
  variant?: Variants
}

export const mapValueToColor: ColorMapper = ({
  value,
  hashSoul,
  circleSoul
}) => {
  const colorH = value >> 4
  const colorS = (value >> 2) & 0x03
  const colorL = value & 0x03
  const h = 360 * hashSoul + 120 * circleSoul + (30 * colorH) / 16
  const s = 50 + (50 * colorS) / 4
  const l = 50 + (40 * colorL) / 8
  return `hsl(${h}, ${s}%, ${l}%)`
}

function generateSection({
  value,
  index,
  outerRadius,
  innerRadius,
  horcrux,
  variant = 'normal'
}: GenerateSectionArgs) {
  const circleIndex = Math.floor(index / 8)
  const staggering =
    variant === 'gem' || variant === 'flower'
      ? circleIndex % 2 === 0
        ? 0.5
        : 0
      : variant === 'stagger'
      ? horcrux
      : 0
  const angle = (index + 0.5) / 8
  const angleA = index / 8
  const angleB = (index + 1) / 8
  const angleOffset = staggering / 8

  const arcRadius =
    variant === 'gem'
      ? 0
      : variant === 'flower'
      ? 0.25 * outerRadius
      : outerRadius

  const path = [
    moveTo({ x: 0, y: 0 }),
    lineTo(polarPoint(outerRadius, angleA)),
    arcTo(polarPoint(outerRadius, angleB), arcRadius, variant === 'spider'),
    'Z' // close the path
  ].join(' ')

  return {
    path,
    transform:
      angleOffset !== 0 ? `rotate(${angleOffset.toFixed(6)}turn)` : undefined,
    label: {
      text: value,
      ...polarPoint(
        innerRadius === 0
          ? outerRadius * 0.66
          : innerRadius + (outerRadius - innerRadius) / 2,
        angle
      )
    }
  }
}

function useHashSoul(bytes: string[]) {
  const circleSize = Math.round(bytes.length / 4)
  const circles = [
    bytes.slice(0, circleSize),
    bytes.slice(1 * circleSize, 2 * circleSize),
    bytes.slice(2 * circleSize, 3 * circleSize),
    bytes.slice(3 * circleSize, 4 * circleSize)
  ]
  const xor = (xor: number, byte: string) => xor ^ parseInt(byte, 16)
  return {
    soul: (bytes.reduce(xor, 0) / 0xff) * 2 - 1,
    horcruxes: circles.map(circle => (circle.reduce(xor, 0) / 0xff) * 2 - 1)
  }
}

// --

export const SHA256Avatar: React.FC<SHA256AvatarProps> = ({
  radiusFactor = 0.42,
  hash = Array(64).fill('0').join(''),
  showGrid = false,
  showLabels = false,
  showSections = true,
  variant = 'normal',
  mapColor = mapValueToColor,
  ...props
}) => {
  const mix = (a: number, b: number) =>
    a * radiusFactor + b * (1 - radiusFactor)

  const r1 = variant === 'flower' ? 0.75 : 1
  const r2 = mix((r1 * Math.sqrt(3)) / 2, r1 * 0.75)
  const r3 = mix((r1 * Math.sqrt(2)) / 2, r1 * 0.5)
  const r4 = mix(r1 * 0.5, r1 * 0.25)

  const bytes = hash?.match(/.{1,2}/g)?.map(block => block) ?? []
  const { soul, horcruxes } = useHashSoul(bytes)
  const bitCount = Math.round((hash?.length ?? 0) / 64) // 32 sections = 64 hex characters

  const innerRadii = [r2, r3, r4, 0]
  const outerRadii = [r1, r2, r3, r4]
  const sections = bytes.map((value, index) => {
    const circleIndex = Math.floor(index / 8)
    const innerRadius = innerRadii[circleIndex]
    const outerRadius = outerRadii[circleIndex]
    const horcrux = horcruxes[circleIndex]
    return {
      ...generateSection({
        value,
        index,
        outerRadius,
        innerRadius,
        variant,
        horcrux
      }),
      color: mapColor({
        value: parseInt(value, 16),
        bitCount,
        hashSoul: soul,
        circleSoul: horcrux
      })
    }
  })

  const gridColor = useToken('colors', 'accent.500')
  const strokeColor = useColorModeValue('white', 'black')

  return (
    <Svg viewBox="-1 -1 2 2" overflow="visible" {...props}>
      <g>
        {sections.map((section, i) => (
          <path
            key={i}
            d={section.path}
            fill={showSections ? section.color : 'none'}
            stroke={showGrid ? gridColor : strokeColor}
            strokeWidth={0.02}
            strokeLinejoin="round"
            style={{
              transition: '.15s ease-out',
              transform: section.transform
            }}
          />
        ))}
      </g>
      {showLabels && (
        <g>
          {sections.map((section, i) => (
            <text
              key={i}
              x={section.label.x}
              y={section.label.y + 0.03}
              text-anchor="middle"
              fontSize={0.1}
              fill="currentColor"
            >
              {section.label.text}
            </text>
          ))}
        </g>
      )}
    </Svg>
  )
}

// --

export const AdjustableRadiusFactorSHA256Avatar: React.FC<SHA256AvatarProps> = ({
  ...props
}) => {
  const [radiusFactor, setRadiusFactor] = React.useState(1)
  return (
    <>
      <SHA256Avatar {...props} radiusFactor={radiusFactor} />
      <Flex justifyContent="space-between" fontSize="sm">
        <Text>Equal Radii</Text>
        <Text>Equal Areas</Text>
      </Flex>
      <Slider
        aria-label="slider-ex-1"
        value={radiusFactor}
        onChange={setRadiusFactor}
        min={0}
        max={1}
        step={0.01}
        colorScheme="accent"
      >
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb />
      </Slider>
      <Text
        textAlign="center"
        fontSize="xs"
        sx={{
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        Blend factor: {radiusFactor.toFixed(2)}
      </Text>
    </>
  )
}

// --

export function useHash(
  text: string,
  defaultValue = Array(64).fill('0').join('')
) {
  const [hash, setHash] = React.useState(defaultValue)
  React.useEffect(() => {
    sha256(text).then(setHash)
  }, [text])
  return hash
}

export const InteractiveAvatar: React.FC<SHA256AvatarProps> = ({
  ...props
}) => {
  const [text, setText] = React.useState('Hello, world!')

  const hash = useHash(
    text,
    '315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3'
  )
  React.useEffect(() => {
    try {
      const query = new URLSearchParams(location.search)
      const demo = query.get('demo')
      if (demo) {
        setText(demo)
      }
    } catch {}
  }, [])

  const hashText = React.useMemo(() => {
    return [hash.slice(0, hash.length / 2), hash.slice(hash.length / 2)].join(
      '<wbr>'
    )
  }, [hash])

  return (
    <>
      <SHA256Avatar {...props} hash={hash} />
      <Text
        fontSize="xs"
        fontFamily="mono"
        color="gray.600"
        textAlign="center"
        mb={4}
        dangerouslySetInnerHTML={{
          __html: hashText
        }}
      />
      <Input
        d="block"
        maxW={64}
        mx="auto"
        value={text}
        onChange={e => setText(e.target.value)}
      />
    </>
  )
}