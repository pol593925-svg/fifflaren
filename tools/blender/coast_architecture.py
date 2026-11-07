"""Mediterranean dressing on the exact server-owned building collision contract.
No facade closes an entrance, stairwell, roof access or window opening.
All surface details are batched with the map, not thousands of runtime meshes.
"""
import json, math, subprocess

def build(a, theme):
    plan=json.loads(subprocess.check_output(['node',str(a.ROOT/'tools/export-coast-buildings.cjs'),theme],cwd=a.ROOT,encoding='utf8'))
    # Keep elevated floors out of the terrain sculpt/grass pass (material 'ground').
    finishes={'wall':'plaster_light','floor':'wood','roof':'limestone','step':'limestone','rail':'plaster','trim':'limestone','wood':'wood','fabric':'shutter'}
    for b in plan['boxes']:
        lo,hi=b['min'],b['max'];kind=b.get('kind','wall');mat=finishes.get(kind,'limestone')
        # Wall foundations use real blockwork, upper surfaces a sun-bleached plaster scan.
        tint=.92+(b.get('building',0)%3)*.025
        a.box(mat,*[(x+y)/2 for x,y in zip(lo,hi)],*[y-x for x,y in zip(lo,hi)],tint=tint)
    for b in plan['buildings']:
        x,z=b['x'],b['z']
        def box(mat,xx,y,zz,w,h,d,tint=1):a.box(mat,x+xx,y,z+zz,w,h,d,tint)
        # Quoins are staggered, with shallow joints. They remain on the existing wall posts.
        for xx in [.10,11.90]:
            for zz in [.08,11.92]:
                for k in range(18):
                    box('limestone',xx,.21+k*.39,zz,.48 if k%2 else .30,.35,.30 if k%2 else .48,.88+(k%4)*.025)
        # Broken stone dado and coping define the house as one 12m frontage.
        for xx,w in [(1.85,3.7),(9.65,4.7)]:box('limestone',xx,.34,-.085,w,.68,.18)
        for zz in [3,9]:box('limestone',-.07,.34,zz,.15,.68,6)
        for y in [3.30,6.88,7.18]:
            box('trim',6,y,-.10,12.28,.13,.30);box('trim',-.10,y,6,.30,.13,12.2);box('trim',12.10,y,6,.30,.13,12.2)
        # Limestone balcony cap on the existing solid cover. Roof walking stays clear.
        box('limestone',5.4,4.32,-1.75,8.25,.10,.30)
        for xx in [1.44,9.34]:box('limestone',xx,4.32,-.9,.28,.10,1.9)
        # Small tiled perimeter eaves, leaving the accessible roof and stair exit open.
        for side in range(4):
            for k in range(44):
                u=.15+k*.275
                for j in range(4):
                    aa=j*math.pi/4;bb=(j+1)*math.pi/4
                    pts=[]
                    for t,v in [(aa,-.16),(bb,-.16),(bb,.34),(aa,.34)]:
                        along=u+math.cos(t)*.13;yy=7.20+math.sin(t)*.08+v*.12
                        xx,zz=(along,v) if side==0 else (12-v,along) if side==1 else (12-along,12-v) if side==2 else (v,12-along)
                        pts.append((x+xx,yy,z+zz))
                    a.face('roof',pts,tint=.82+(k%5)*.035)
        # Pots and planter rims share map batches; no per-pot draw call or extra light.
        for xx,zz in [(1.0,-.50),(10.7,-.48)]:
            for yy,rr,hh in [(.14,.24,.28),(.37,.31,.22),(.51,.33,.07)]:a.cylinder('roof',x+xx,yy,z+zz,rr,hh,14)
            a.cylinder('dark',x+xx,.55,z+zz,.27,.02,14)
            for j in range(18):
                ang=j*2.399;r=.12+(j%3)*.055;cx=xx+math.sin(ang)*r;cz=zz+math.cos(ang)*r;yy=.57+(j%5)*.065
                a.face('shutter',[(x+cx-.10,yy,z+cz),(x+cx,yy+.12,z+cz+.05),(x+cx+.10,yy,z+cz),(x+cx,yy-.04,z+cz-.05)],tint=1.2)
        # Voussoir arches frame, rather than fill, the rectangular door opening.
        def arch(cx,base,radius,zfront,depth=.18):
            for k in range(20):
                aa=k*math.pi/20+.012;bb=(k+1)*math.pi/20-.012
                pts=[(x+cx+math.cos(t)*r,base+math.sin(t)*r,z+zfront) for t,r in [(aa,radius),(aa,radius+.17),(bb,radius+.17),(bb,radius)]]
                a.face('limestone',pts,tint=.87+(k%4)*.025)
                a.face('limestone',[pts[0],pts[3],(pts[3][0],pts[3][1],pts[3][2]+depth),(pts[0][0],pts[0][1],pts[0][2]+depth)])
        arch(5.5,2.61,.72,-.19)
        for xx in [3.86,7.14]:
            for k in range(7):box('limestone',xx,.19+k*.37,-.13,.26,.34,.30,.91+(k%3)*.025)
        # Real louver slats, iron hinge pins and deep sills outside every opening.
        for cx in [2.5,6,9.5]:
            for side in [-1,1]:
                sx=cx+side*1.30
                box('shutter',sx,5.25,-.17,.44,1.52,.11)
                for k in range(11):box('shutter',sx,4.57+k*.126,-.24,.41,.052,.06,.84+(k%3)*.03)
                for y in [4.68,5.82]:box('steel',sx,y,-.28,.40,.04,.028)
            box('limestone',cx,4.40,-.18,2.25,.16,.42)
            box('trim',cx,6.08,-.14,2.27,.18,.30)
            # Aged timber lintels emphasize the real open window instead of a painted pane.
            box('wood',cx,6.20,-.1,2.32,.08,.18)
        # Facade lanterns are low-poly iron frames with a warm light source.
        for xx in [.75,10.9]:
            box('steel',xx,2.63,-.15,.12,.30,.10)
            box('steel',xx,2.82,-.35,.06,.06,.40)
            box('steel',xx,2.62,-.47,.28,.04,.25)
            box('steel',xx,2.94,-.47,.34,.07,.31)
            box('lamp_warm',xx,2.78,-.47,.18,.21,.16)
            for dx in [-.13,.13]:
                for dz in [-.10,.10]:box('steel',xx+dx,2.78,-.47+dz,.025,.30,.025)
        # Terracotta half-round tiles over the existing entrance awning.
        for xx in range(16):
            cx=3.64+xx*.245
            for k in range(4):
                zz=-.75+k*.20
                for j in range(6):
                    aa=j*math.pi/6;bb=(j+1)*math.pi/6
                    a.face('roof',[(x+cx+math.cos(aa)*.115,2.95+math.sin(aa)*.11,z+zz),(x+cx+math.cos(bb)*.115,2.95+math.sin(bb)*.11,z+zz),(x+cx+math.cos(bb)*.115,3.00+math.sin(bb)*.11,z+zz+.23),(x+cx+math.cos(aa)*.115,3.00+math.sin(aa)*.11,z+zz+.23)],tint=.80+(xx%4)*.055)
        # Skirting and thin stair edge strips help read depth indoors.
        for y in [0,3.6]:
            box('wood',.27,y+.11,6,.055,.17,11.4)
            if y == 0:
                for k in range(20):box('trim',9.68,k*.18+.184,.5+k*.5,1.34,.012,.07)
            for zz in [4.11,6.18]:box('wood',3.04,y+1.19,zz,.10,2.39,.085)
            box('wood',3.04,y+2.38,5.15,.10,.085,2.16)
    return len(plan['buildings'])
