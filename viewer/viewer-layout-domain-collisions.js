export function resolveDomainCollisions(boxes) {
  for (let tick = 0; tick < 120; tick += 1) {
    let moved = false
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        moved = resolvePair(boxes[first], boxes[second]) || moved
      }
    }
    if (!moved) {
      return
    }
  }
}

function resolvePair(a, b) {
  const ax = a.x + a.width / 2
  const ay = a.y + a.height / 2
  const bx = b.x + b.width / 2
  const by = b.y + b.height / 2
  const overlapX = (a.width + b.width) / 2 + 34 - Math.abs(bx - ax)
  const overlapY = (a.height + b.height) / 2 + 34 - Math.abs(by - ay)
  if (overlapX <= 0 || overlapY <= 0) {
    return false
  }
  const pushX = bx >= ax ? overlapX / 2 : -overlapX / 2
  const pushY = by >= ay ? overlapY / 2 : -overlapY / 2
  if (overlapX < overlapY) {
    a.x -= pushX
    b.x += pushX
  } else {
    a.y -= pushY
    b.y += pushY
  }
  return true
}
