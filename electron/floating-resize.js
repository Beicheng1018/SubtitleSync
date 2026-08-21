const RESIZE_EDGES = new Set([
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
]);

function isResizeEdge(edge) {
  return RESIZE_EDGES.has(edge);
}

function resizedBounds(startBounds, deltaX, deltaY, edge, minWidth, minHeight) {
  if (!isResizeEdge(edge)) {
    return { ...startBounds };
  }

  const dx = Math.round(Number(deltaX) || 0);
  const dy = Math.round(Number(deltaY) || 0);
  const minimumWidth = Math.max(1, Math.round(Number(minWidth) || 1));
  const minimumHeight = Math.max(1, Math.round(Number(minHeight) || 1));
  const startRight = startBounds.x + startBounds.width;
  const startBottom = startBounds.y + startBounds.height;
  const next = { ...startBounds };

  if (edge.includes('left')) {
    next.width = Math.max(minimumWidth, startBounds.width - dx);
    next.x = startRight - next.width;
  } else if (edge.includes('right')) {
    next.width = Math.max(minimumWidth, startBounds.width + dx);
  }

  if (edge.includes('top')) {
    next.height = Math.max(minimumHeight, startBounds.height - dy);
    next.y = startBottom - next.height;
  } else if (edge.includes('bottom')) {
    next.height = Math.max(minimumHeight, startBounds.height + dy);
  }

  return next;
}

module.exports = {
  RESIZE_EDGES,
  isResizeEdge,
  resizedBounds
};
