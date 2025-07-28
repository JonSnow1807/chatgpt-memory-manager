"""
Icon Generator for ChatGPT Memory Manager Extension
Creates icon16.png, icon48.png, and icon128.png
"""

import os

# Install required package if needed:
# pip install cairosvg pillow

try:
    import cairosvg
    from PIL import Image
    import io
except ImportError:
    print("Installing required packages...")
    os.system("pip install cairosvg pillow")
    import cairosvg
    from PIL import Image
    import io

# SVG templates for each size
svg_16 = '''<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad16" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
    </defs>
    <circle cx="8" cy="7" r="5" fill="url(#grad16)"/>
    <circle cx="11" cy="4" r="2" fill="#10a37f"/>
    <circle cx="11" cy="4" r="1" fill="white"/>
</svg>'''

svg_48 = '''<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad48" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow48">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
    </defs>
    <path d="M24 8c-8.8 0-16 7.2-16 16 0 4.4 1.8 8.4 4.7 11.3 2.9 2.9 6.9 4.7 11.3 4.7 8.8 0 16-7.2 16-16S32.8 8 24 8z" 
          fill="url(#grad48)" filter="url(#shadow48)"/>
    <path d="M18 20c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm8 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-4 8c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" 
          fill="white" opacity="0.9"/>
    <path d="M20 20h8M24 22v6" stroke="white" stroke-width="1" opacity="0.5"/>
    <circle cx="36" cy="12" r="8" fill="#10a37f" filter="url(#shadow48)"/>
    <path d="M33 12l2 2 5-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

svg_128 = '''<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad128" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad128light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8fa1ff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#a374d5;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.25"/>
        </filter>
    </defs>
    
    <circle cx="64" cy="64" r="48" fill="url(#grad128)" filter="url(#shadow)"/>
    
    <path d="M64 28c-19.9 0-36 16.1-36 36 0 9.9 4 18.9 10.5 25.5C45.1 96.1 54.1 100 64 100c19.9 0 36-16.1 36-36S83.9 28 64 28z" 
          fill="url(#grad128light)" opacity="0.3"/>
    
    <g opacity="0.8">
        <circle cx="48" cy="48" r="6" fill="white"/>
        <circle cx="80" cy="48" r="6" fill="white"/>
        <circle cx="64" cy="64" r="8" fill="white"/>
        <circle cx="48" cy="80" r="6" fill="white"/>
        <circle cx="80" cy="80" r="6" fill="white"/>
        <path d="M48 48L64 64M80 48L64 64M48 80L64 64M80 80L64 64" 
              stroke="white" stroke-width="2" opacity="0.6"/>
    </g>
    
    <circle cx="96" cy="32" r="24" fill="#10a37f" filter="url(#shadow)"/>
    <circle cx="96" cy="32" r="20" fill="none" stroke="white" stroke-width="2" opacity="0.5"/>
    
    <g fill="white">
        <path d="M96 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
        <circle cx="88" cy="24" r="1.5" opacity="0.8"/>
        <circle cx="104" cy="40" r="1.5" opacity="0.8"/>
    </g>
</svg>'''

def create_icon(svg_content, size, filename):
    """Convert SVG to PNG at specified size"""
    try:
        # Convert SVG to PNG
        png_data = cairosvg.svg2png(
            bytestring=svg_content.encode('utf-8'),
            output_width=size,
            output_height=size
        )
        
        # Save the PNG
        with open(filename, 'wb') as f:
            f.write(png_data)
        
        print(f"✅ Created {filename} ({size}x{size}px)")
        
    except Exception as e:
        print(f"❌ Error creating {filename}: {e}")

def main():
    print("🎨 ChatGPT Memory Manager - Icon Generator")
    print("-" * 40)
    
    # Create extension/images directory if it doesn't exist
    if not os.path.exists('extension'):
        os.makedirs('extension')
    if not os.path.exists('extension/images'):
        os.makedirs('extension/images')
    
    # Generate all three icons
    create_icon(svg_16, 16, 'extension/images/icon16.png')
    create_icon(svg_48, 48, 'extension/images/icon48.png')
    create_icon(svg_128, 128, 'extension/images/icon128.png')
    
    print("\n✨ All icons created successfully!")
    print("\n📝 Next steps:")
    print("1. Check the extension/images/ folder")
    print("2. Update your manifest.json with:")
    print('''
    "icons": {
      "16": "images/icon16.png",
      "48": "images/icon48.png",
      "128": "images/icon128.png"
    }
    ''')

if __name__ == "__main__":
    main()