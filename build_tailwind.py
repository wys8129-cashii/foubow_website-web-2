#!/usr/bin/env python3
"""
Build Tailwind CSS without npm.
This script downloads the prebuilt Tailwind CSS and adds custom styles.
"""

import os
import requests

def build_tailwind_css():
    # Ensure output directories exist
    os.makedirs('public/css', exist_ok=True)
    
    # Download Tailwind CSS v3.4.14 from CDN
    print("Downloading Tailwind CSS...")
    tailwind_url = "https://cdn.jsdelivr.net/npm/tailwindcss@3.4.14/dist/tailwind.min.css"
    try:
        response = requests.get(tailwind_url, timeout=30)
        response.raise_for_status()
        tailwind_css = response.text
        print("✓ Tailwind CSS downloaded successfully")
    except Exception as e:
        print(f"✗ Failed to download Tailwind CSS: {e}")
        # Use fallback embedded CSS
        tailwind_css = ""
    
    # Custom theme styles
    custom_styles = """
@layer base {
    :root {
        --color-on-primary-fixed-variant: #004e5c;
        --color-tertiary-container: #97a8c1;
        --color-secondary-container: #8fa7fe;
        --color-surface-container-high: #e6e8ea;
        --color-on-tertiary: #ffffff;
        --color-surface-variant: #e0e3e5;
        --color-primary-fixed: #acedff;
        --color-on-error: #ffffff;
        --color-on-secondary: #ffffff;
        --color-on-surface: #191c1e;
        --color-tertiary: #505f76;
        --color-surface: #f7f9fb;
        --color-surface-bright: #f7f9fb;
        --color-surface-container-low: #f2f4f6;
        --color-outline-variant: #bcc9cd;
        --color-outline: #6d797d;
        --color-primary-container: #06b6d4;
        --color-on-primary-fixed: #001f26;
        --color-tertiary-fixed: #d3e4fe;
        --color-primary: #06B6D4;
        --color-inverse-primary: #4cd7f6;
        --color-on-error-container: #93000a;
        --color-on-secondary-fixed: #00164e;
        --color-secondary-fixed-dim: #b6c4ff;
        --color-surface-container-highest: #e0e3e5;
        --color-surface-tint: #06B6D4;
        --color-secondary: #4059aa;
        --color-on-surface-variant: #3d494c;
        --color-on-background: #191c1e;
        --color-inverse-on-surface: #eff1f3;
        --color-background: #f7f9fb;
        --color-on-secondary-fixed-variant: #264191;
        --color-on-primary: #ffffff;
        --color-secondary-fixed: #dce1ff;
        --color-surface-dim: #d8dadc;
        --color-error: #ba1a1a;
        --color-primary-fixed-dim: #4cd7f6;
        --color-on-primary-container: #00424f;
        --color-on-tertiary-container: #2d3d52;
        --color-surface-container-lowest: #ffffff;
        --color-error-container: #ffdad6;
        --color-on-tertiary-fixed-variant: #38485d;
        --color-inverse-surface: #2d3133;
        --color-tertiary-fixed-dim: #b7c8e1;
        --color-on-secondary-container: #1d3989;
        --color-on-tertiary-fixed: #0b1c30;
        --color-surface-container: #eceef0;
        
        --font-family-headline-lg: 'Inter', sans-serif;
        --font-family-body-lg: 'Inter', sans-serif;
        --font-family-label-sm: 'JetBrains Mono', monospace;
        --font-family-title-md: 'Inter', sans-serif;
        --font-family-body-md: 'Inter', sans-serif;
        --font-family-headline-lg-mobile: 'Inter', sans-serif;
        --font-family-display-lg: 'Inter', sans-serif;
        
        --spacing-margin-mobile: 20px;
        --spacing-gutter: 24px;
        --spacing-container-max: 1280px;
        --spacing-margin-desktop: 64px;
        --spacing-base: 8px;
    }
}

@layer utilities {
    .glass-card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
    }
    
    .glass-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 40px -12px rgba(6, 182, 212, 0.12);
        border-color: #06B6D4;
    }
    
    .glass-panel {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.3);
    }
    
    .primary-gradient-bg {
        background: linear-gradient(135deg, #06B6D4 0%, #0891b2 100%);
    }
    
    .primary-gradient {
        background: linear-gradient(135deg, #06B6D4 0%, #22d3ee 100%);
    }
    
    .hero-gradient {
        background: radial-gradient(circle at top right, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
    }
    
    .bg-mesh {
        background-color: #f7f9fb;
        background-image: 
            radial-gradient(at 0% 0%, rgba(6, 182, 212, 0.15) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(64, 89, 170, 0.1) 0px, transparent 50%);
    }
    
    .font-headline-lg {
        font-family: var(--font-family-headline-lg);
        font-size: 32px;
        line-height: 40px;
        letter-spacing: -0.01em;
        font-weight: 600;
    }
    
    .font-body-lg {
        font-family: var(--font-family-body-lg);
        font-size: 18px;
        line-height: 28px;
        font-weight: 400;
    }
    
    .font-label-sm {
        font-family: var(--font-family-label-sm);
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.05em;
        font-weight: 500;
    }
    
    .font-title-md {
        font-family: var(--font-family-title-md);
        font-size: 20px;
        line-height: 28px;
        font-weight: 500;
    }
    
    .font-body-md {
        font-family: var(--font-family-body-md);
        font-size: 16px;
        line-height: 24px;
        font-weight: 400;
    }
    
    .font-headline-lg-mobile {
        font-family: var(--font-family-headline-lg-mobile);
        font-size: 24px;
        line-height: 32px;
        font-weight: 600;
    }
    
    .font-display-lg {
        font-family: var(--font-family-display-lg);
        font-size: 48px;
        line-height: 56px;
        letter-spacing: -0.02em;
        font-weight: 700;
    }
    
    .text-headline-lg {
        font-size: 32px;
        line-height: 40px;
        letter-spacing: -0.01em;
        font-weight: 600;
    }
    
    .text-body-lg {
        font-size: 18px;
        line-height: 28px;
        font-weight: 400;
    }
    
    .text-label-sm {
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.05em;
        font-weight: 500;
    }
    
    .text-title-md {
        font-size: 20px;
        line-height: 28px;
        font-weight: 500;
    }
    
    .text-body-md {
        font-size: 16px;
        line-height: 24px;
        font-weight: 400;
    }
    
    .text-headline-lg-mobile {
        font-size: 24px;
        line-height: 32px;
        font-weight: 600;
    }
    
    .text-display-lg {
        font-size: 48px;
        line-height: 56px;
        letter-spacing: -0.02em;
        font-weight: 700;
    }
}

/* Material Icons */
.material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Custom styles */
body {
    background-color: #f7f9fb;
    font-family: 'Inter', sans-serif;
}
"""
    
    # Combine and write to file
    full_css = tailwind_css + "\n" + custom_styles
    
    with open('public/css/tailwind.css', 'w') as f:
        f.write(full_css)
    
    print("✓ Tailwind CSS built successfully at public/css/tailwind.css")

if __name__ == "__main__":
    build_tailwind_css()
