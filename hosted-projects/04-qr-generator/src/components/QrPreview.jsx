/** The live preview. Same geometry the PNG export uses, drawn as React SVG. */
export default function QrPreview({ geo, logoHref }) {
  return (
    <svg
      viewBox={`0 0 ${geo.extent} ${geo.extent}`}
      className="size-full"
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code preview"
    >
      {geo.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} fillRule={p.fillRule} />
      ))}
      {geo.padPath && <path d={geo.padPath.d} fill={geo.padPath.fill} />}
      {geo.logoBox && logoHref && (
        <image
          href={logoHref}
          x={geo.logoBox.x}
          y={geo.logoBox.y}
          width={geo.logoBox.w}
          height={geo.logoBox.h}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </svg>
  )
}
