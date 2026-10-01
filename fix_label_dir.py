with open("components/renderers/AssetRenderer.tsx", "r", encoding="utf-8") as f:
    c = f.read()

old_logic = """        let tx = 0;
        let ty = 0;

        switch (pos) {
            case 'top': ty = -halfH - padding; break;
            case 'bottom': ty = halfH + padding; break;
            case 'top-left': tx = -halfW; ty = -halfH - padding; break;
            case 'top-right': tx = halfW; ty = -halfH - padding; break;
            case 'bottom-left': tx = -halfW; ty = halfH + padding; break;
            case 'bottom-right': tx = halfW; ty = halfH + padding; break;
            case 'middle-left': tx = -halfW - padding; break;
            case 'middle-right': tx = halfW + padding; break;
            default: break;
        }

        if (flipX) tx = -tx;
        if (flipY) ty = -ty;

        const rad = rotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        const worldX = asset.x + baseScale * (cosR * tx - sinR * ty);
        const worldY = asset.y + baseScale * (sinR * tx + cosR * ty);"""

new_logic = """        let tx = 0;
        let ty = 0;
        
        const rad = rotation * Math.PI / 180;
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);

        // Compute the rotated visual bounding box
        const visHalfW = Math.abs(halfW * cosR) + Math.abs(halfH * sinR);
        const visHalfH = Math.abs(halfW * sinR) + Math.abs(halfH * cosR);

        switch (pos) {
            case 'top': ty = -visHalfH - padding; break;
            case 'bottom': ty = visHalfH + padding; break;
            case 'top-left': tx = -visHalfW; ty = -visHalfH - padding; break;
            case 'top-right': tx = visHalfW; ty = -visHalfH - padding; break;
            case 'bottom-left': tx = -visHalfW; ty = visHalfH + padding; break;
            case 'bottom-right': tx = visHalfW; ty = visHalfH + padding; break;
            case 'middle-left': tx = -visHalfW - padding; break;
            case 'middle-right': tx = visHalfW + padding; break;
            default: break;
        }

        // Do not apply flipX, flipY, or rotation to the label position itself,
        // because we want the label to always stay in the absolute visual direction requested.
        const worldX = asset.x + baseScale * tx;
        const worldY = asset.y + baseScale * ty;"""

c = c.replace(old_logic, new_logic)
with open("components/renderers/AssetRenderer.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated AssetRenderer tableLabel direction")
