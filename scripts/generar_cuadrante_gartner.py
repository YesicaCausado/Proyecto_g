"""
Generador del Cuadrante Mágico de Gartner — NeuroLearn AI
Nicho: Educación Técnica / Universitaria con IA
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import os

def generar_cuadrante():
    fig, ax = plt.subplots(1, 1, figsize=(14, 10))
    
    # ── Colores de fondo por cuadrante ──
    # Challengers (arriba izquierda)
    ax.add_patch(plt.Rectangle((0, 5), 5, 5, facecolor='#FFF3E0', edgecolor='none'))
    # Leaders (arriba derecha)
    ax.add_patch(plt.Rectangle((5, 5), 5, 5, facecolor='#E8F5E9', edgecolor='none'))
    # Niche Players (abajo izquierda)
    ax.add_patch(plt.Rectangle((0, 0), 5, 5, facecolor='#E3F2FD', edgecolor='none'))
    # Visionaries (abajo derecha)
    ax.add_patch(plt.Rectangle((5, 0), 5, 5, facecolor='#F3E5F5', edgecolor='none'))
    
    # ── Líneas divisorias ──
    ax.axhline(y=5, color='#666666', linewidth=1.5, linestyle='-')
    ax.axvline(x=5, color='#666666', linewidth=1.5, linestyle='-')
    
    # ── Borde exterior ──
    ax.add_patch(plt.Rectangle((0, 0), 10, 10, fill=False, edgecolor='#333333', linewidth=2))
    
    # ── Nombres de cuadrantes ──
    ax.text(2.5, 9.5, 'CHALLENGERS', ha='center', va='top', fontsize=13, 
            fontweight='bold', color='#E65100', style='italic')
    ax.text(7.5, 9.5, 'LEADERS', ha='center', va='top', fontsize=13, 
            fontweight='bold', color='#2E7D32', style='italic')
    ax.text(2.5, 4.8, 'NICHE PLAYERS', ha='center', va='top', fontsize=13, 
            fontweight='bold', color='#1565C0', style='italic')
    ax.text(2.5, 4.35, '(Ed. Técnica / Universitaria)', ha='center', va='top', fontsize=9, 
            fontweight='normal', color='#1565C0', style='italic')
    ax.text(7.5, 4.8, 'VISIONARIES', ha='center', va='top', fontsize=13, 
            fontweight='bold', color='#7B1FA2', style='italic')
    
    # ════════════════════════════════════════════
    #  DATOS: Empresas por cuadrante
    #  (x = integridad de visión, y = capacidad de ejecución)
    # ════════════════════════════════════════════
    
    # ── LEADERS (arriba derecha) ──
    leaders = [
        (7.8, 9.0, 'Microsoft'),
        (7.2, 8.3, 'Google'),
        (6.5, 7.8, 'Pearson'),
        (8.5, 7.2, 'Amazon AWS'),
        (6.0, 6.8, 'IBM'),
    ]
    
    # ── CHALLENGERS (arriba izquierda) ──
    challengers = [
        (3.8, 8.5, 'Coursera'),
        (3.2, 7.8, 'Udemy'),
        (2.0, 7.2, 'Platzi'),
        (4.2, 7.0, 'edX'),
        (1.5, 6.5, 'Khan Academy'),
    ]
    
    # ── VISIONARIES (abajo derecha) ──
    visionaries = [
        (7.5, 3.8, 'Carnegie Learning'),
        (6.8, 3.2, 'Knewton'),
        (8.2, 4.2, 'Duolingo'),
        (6.2, 2.5, 'DreamBox'),
        (7.0, 1.8, 'Century Tech'),
        (5.8, 1.2, 'Cognii'),
    ]
    
    # ── NICHE PLAYERS - Ed. Técnica/Universitaria (abajo izquierda) ──
    niche = [
        (3.5, 3.5, 'Emeritus'),
        (3.0, 2.8, 'upGrad'),
        (2.0, 1.8, 'Stepful'),
        (4.0, 1.5, 'Querium'),
        (1.5, 2.2, 'Riiid Labs'),
    ]
    
    # ★ NEUROLEARN AI — Posición especial en el nicho
    neurolearn = (2.5, 3.0, '★ NeuroLearn AI')
    
    # ── Dibujar empresas ──
    # Leaders - verde
    for x, y, name in leaders:
        ax.plot(x, y, 'o', color='#2E7D32', markersize=10, markeredgecolor='white', markeredgewidth=1.2)
        ax.annotate(name, (x, y), textcoords="offset points", xytext=(10, -3),
                   fontsize=8.5, color='#1B5E20', fontweight='bold')
    
    # Challengers - naranja
    for x, y, name in challengers:
        ax.plot(x, y, 'o', color='#E65100', markersize=10, markeredgecolor='white', markeredgewidth=1.2)
        ax.annotate(name, (x, y), textcoords="offset points", xytext=(10, -3),
                   fontsize=8.5, color='#BF360C', fontweight='bold')
    
    # Visionaries - púrpura
    for x, y, name in visionaries:
        ax.plot(x, y, 'o', color='#7B1FA2', markersize=10, markeredgecolor='white', markeredgewidth=1.2)
        ax.annotate(name, (x, y), textcoords="offset points", xytext=(10, -3),
                   fontsize=8.5, color='#4A148C', fontweight='bold')
    
    # Niche Players - azul
    for x, y, name in niche:
        ax.plot(x, y, 'o', color='#1565C0', markersize=10, markeredgecolor='white', markeredgewidth=1.2)
        ax.annotate(name, (x, y), textcoords="offset points", xytext=(10, -3),
                   fontsize=8.5, color='#0D47A1', fontweight='bold')
    
    # ★ NeuroLearn AI — ESTRELLA GRANDE ROJA
    nx, ny, nname = neurolearn
    ax.plot(nx, ny, '*', color='#D32F2F', markersize=28, markeredgecolor='#B71C1C', 
            markeredgewidth=1, zorder=10)
    ax.annotate('NeuroLearn AI', (nx, ny), textcoords="offset points", xytext=(18, -2),
               fontsize=11, color='#B71C1C', fontweight='bold',
               bbox=dict(boxstyle='round,pad=0.3', facecolor='#FFCDD2', edgecolor='#D32F2F', alpha=0.9))
    
    # ── Flecha de trayectoria NeuroLearn AI → Visionary ──
    ax.annotate('', xy=(5.8, 3.5), xytext=(3.0, 3.1),
               arrowprops=dict(arrowstyle='->', color='#D32F2F', lw=2.5, 
                              connectionstyle='arc3,rad=0.2', linestyle='--'))
    ax.text(4.3, 3.8, 'Meta 2027', fontsize=8, color='#D32F2F', fontweight='bold',
            style='italic', ha='center')
    
    # ── Ejes ──
    ax.set_xlim(-0.5, 10.8)
    ax.set_ylim(-1.0, 11.0)
    ax.set_xlabel('INTEGRIDAD DE VISIÓN  →', fontsize=12, fontweight='bold', 
                  color='#333333', labelpad=10)
    ax.set_ylabel('←  CAPACIDAD DE EJECUCIÓN', fontsize=12, fontweight='bold', 
                  color='#333333', labelpad=10, rotation=90)
    
    # Quitar ticks numéricos
    ax.set_xticks([])
    ax.set_yticks([])
    
    # Labels en extremos de ejes
    ax.text(0.2, -0.6, 'Baja', fontsize=9, color='#888888', ha='left')
    ax.text(9.5, -0.6, 'Alta', fontsize=9, color='#888888', ha='right')
    ax.text(-0.3, 0.3, 'Baja', fontsize=9, color='#888888', ha='center', rotation=90)
    ax.text(-0.3, 9.5, 'Alta', fontsize=9, color='#888888', ha='center', rotation=90)
    
    # ── Título ──
    ax.set_title(
        'Cuadrante Mágico de Gartner — NeuroLearn AI\n'
        'Mercado: IA en Educación Técnica / Universitaria',
        fontsize=15, fontweight='bold', color='#1a1a1a', pad=20
    )
    
    # ── Leyenda ──
    legend_elements = [
        mpatches.Patch(facecolor='#E8F5E9', edgecolor='#2E7D32', label='Leaders — Big Tech con escala masiva'),
        mpatches.Patch(facecolor='#FFF3E0', edgecolor='#E65100', label='Challengers — "Netflix de cursos" sin IA real'),
        mpatches.Patch(facecolor='#F3E5F5', edgecolor='#7B1FA2', label='Visionaries — IA adaptativa, falta escala'),
        mpatches.Patch(facecolor='#E3F2FD', edgecolor='#1565C0', label='Niche: Ed. Técnica/Universitaria (NOSOTROS)'),
        plt.Line2D([0], [0], marker='*', color='w', markerfacecolor='#D32F2F', 
                   markersize=18, label='★ NeuroLearn AI — Modelado Neuroconductual'),
    ]
    ax.legend(handles=legend_elements, loc='lower center', bbox_to_anchor=(0.5, -0.18),
             ncol=2, fontsize=8.5, frameon=True, fancybox=True, shadow=True)
    
    # ── Nota al pie ──
    fig.text(0.5, 0.01, 
             'Mercado AI en Educación: $5.88B (2024) → $32.27B (2030) | CAGR 31.2% | '
             'Fuentes: Grand View Research, HolonIQ 2026',
             ha='center', fontsize=7.5, color='#999999', style='italic')
    
    plt.tight_layout()
    plt.subplots_adjust(bottom=0.18)
    
    # ── Guardar ──
    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(os.path.dirname(output_dir), 'cuadrante_gartner_neurolearn.png')
    fig.savefig(output_path, dpi=200, bbox_inches='tight', facecolor='white', edgecolor='none')
    print(f"✅ Gráfico guardado en: {output_path}")
    
    # También guardar en PDF para presentación
    pdf_path = os.path.join(os.path.dirname(output_dir), 'cuadrante_gartner_neurolearn.pdf')
    fig.savefig(pdf_path, dpi=200, bbox_inches='tight', facecolor='white', edgecolor='none')
    print(f"✅ PDF guardado en: {pdf_path}")
    
    plt.show()


if __name__ == '__main__':
    generar_cuadrante()
