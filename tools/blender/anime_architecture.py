"""Curved roof wings and habitable townhouses; consumes the same collision plan as the server."""
import json, math, subprocess

def build(a,theme):
    plan=json.loads(subprocess.check_output(['node',str(a.ROOT/'tools/export-coast-buildings.cjs'),theme],cwd=a.ROOT,encoding='utf8'))
    finishes={'wall':'plaster_light','floor':'wood','roof':'limestone','step':'limestone','rail':'plaster','trim':'trim','wood':'wood','fabric':'shutter'}
    for box in plan['boxes']:
        if box.get('animeRoof'):continue
        lo,hi=box['min'],box['max'];kind=box.get('kind','wall');mat=finishes.get(kind,'limestone')
        if kind=='wall' and box.get('building',0)%3==1:mat='plaster_blue'
        a.box(mat,*[(x+y)/2 for x,y in zip(lo,hi)],*[y-x for x,y in zip(lo,hi)])
    def lathe(mat,x,z,rings,n=16):
        for (y,r),(yy,rr) in zip(rings,rings[1:]):
            for j in range(n):
                p,q=j*math.tau/n,(j+1)*math.tau/n
                a.face(mat,[(x+math.cos(p)*r,y,z+math.sin(p)*r),(x+math.cos(q)*r,y,z+math.sin(q)*r),(x+math.cos(q)*rr,yy,z+math.sin(q)*rr),(x+math.cos(p)*rr,yy,z+math.sin(p)*rr)])
    def ribbon(mat,points,width):
        for p,q in zip(points,points[1:]):
            a.face(mat,[(p[0],p[1]-width,p[2]),(q[0],q[1]-width,q[2]),(q[0],q[1]+width,q[2]),(p[0],p[1]+width,p[2])])
    for b in plan['buildings']:
        x,z=b['x'],b['z'];bid=b['id']
        def box(mat,xx,y,zz,w,h,d):a.box(mat,x+xx,y,z+zz,w,h,d)
        def height(u):return 7.92+1.7*max(0,1-abs((u-4.5)/4.35))**1.25
        # A curved gable over the front wing gives a true silhouette. Rear rooftop is a terrace.
        for j in range(48):
            u=.15+j*8.7/48;v=u+8.7/48
            for k in range(14):
                zz=-.25+k*5.5/14;end=zz+5.5/14
                # Raised overlapping ceramic courses, welded and smooth-shaded at export.
                lift=.018*math.sin(k*1.9)+.016*(k%2)
                a.face('roof',[(x+u,height(u)+lift,z+zz),(x+u,height(u)+lift,z+end),(x+v,height(v)+lift,z+end),(x+v,height(v)+lift,z+zz)])
            for zz in [-.25,5.25]:
                a.face('plaster_blue' if bid%3==1 else 'plaster_light',[(x+u,7.18,z+zz),(x+v,7.18,z+zz),(x+v,height(v),z+zz),(x+u,height(u),z+zz)])
        for zz in [-.28,5.28]:
            points=[(x+.15+j*8.7/48,height(.15+j*8.7/48)-.09,z+zz) for j in range(49)]
            ribbon('wood',points,.10);ribbon('trim',[(px,py+.14,pz-.01)for px,py,pz in points],.035)
        # Round ridge finial and carved oculus on the gable; no decorative fake door.
        for zz in [-.3,5.3]:lathe('trim',x+4.5,z+zz,[(9.42,.07),(9.62,.12),(9.77,.04),(9.82,0)],12)
        for j in range(32):
            aa=j*math.tau/32;bb=(j+1)*math.tau/32
            a.face('trim',[(x+4.5+math.cos(t)*r,8.54+math.sin(t)*r,z-.265)for t,r in [(aa,.31),(aa,.42),(bb,.42),(bb,.31)]])
        box('shutter',4.5,8.54,-.255,.52,.52,.018)
        box('wood',4.5,8.54,-.28,.035,.63,.025);box('wood',4.5,8.54,-.28,.63,.035,.025)
        # Rounded corner pilasters with shaped capitals replace stacks of cube stones.
        for xx,zz in [(.12,.10),(11.87,.10),(.12,11.87),(11.87,11.87)]:
            lathe('trim',x+xx,z+zz,[(0,.24),(.16,.29),(.30,.24),(.43,.19),(3.22,.19),(3.32,.25),(3.45,.25),(3.56,.18),(6.83,.18),(6.94,.26),(7.08,.26)],16)
        # Two-layer cornices and curved entrance canopy.
        for y in [3.32,6.88]:
            for k in range(4):
                t=k/4;d=.10+.14*math.sin(t*math.pi/2)
                box('trim',6,y+t*.16,-d/2,12.18,.055,d)
        for j in range(28):
            u=3.65+j*.14;v=u+.14
            for k in range(6):
                zz=-.84+k*.14;end=zz+.14
                h=lambda q:2.83+.19*math.sin((q+.84)/.84*math.pi/2)
                a.face('roof',[(x+u,h(zz),z+zz),(x+u,h(end),z+end),(x+v,h(end),z+end),(x+v,h(zz),z+zz)])
        # Arched stone door frame lies outside the full 3m x 2.6m opening.
        for j in range(24):
            aa=j*math.pi/24;bb=(j+1)*math.pi/24
            a.face('trim',[(x+5.5+math.cos(t)*r,2.6+math.sin(t)*r*.34,z-.16)for t,r in [(aa,1.5),(aa,1.7),(bb,1.7),(bb,1.5)]])
        for xx in [3.89,7.11]:lathe('trim',x+xx,z-.08,[(0,.10),(.15,.16),(.28,.11),(2.48,.11),(2.60,.16)],12)
        # Window shutters and curved over-window mouldings; keep each opening clear.
        for cx in [2.5,6,9.5]:
            for s in [-1,1]:
                sx=cx+s*1.29;box('shutter',sx,5.22,-.15,.43,1.48,.10)
                for k in range(8):box('wood',sx,4.62+k*.16,-.21,.38,.035,.035)
            points=[(x+cx-1.15+j*.115,6.12+.13*math.sin(j*math.pi/20),z-.18)for j in range(21)]
            ribbon('trim',points,.07)
        # Balcony coping and curled metal balusters sit on existing solid parapet.
        box('trim',5.4,4.33,-1.8,8.25,.12,.24)
        for j in range(12):
            cx=x+1.8+j*.65
            points=[(cx+.18*math.sin(k*math.tau/24),4.55+.16*math.cos(k*math.tau/24),z-1.84)for k in range(25)]
            ribbon('steel',points,.017)
        # Sculpted ceramic planters with petal rosettes, not flat triangular flowers.
        for xx,zz in [(.85,-.6),(10.8,-.6)]:
            lathe('roof',x+xx,z+zz,[(.03,.22),(.12,.28),(.35,.39),(.58,.32),(.63,.34),(.68,.34)],18)
            for j in range(9):
                ang=j*2.399;cx=x+xx+math.sin(ang)*.23;cz=z+zz+math.cos(ang)*.23;cy=.75+(j%3)*.10
                for k in range(6):
                    aa=k*math.tau/6;bb=(k+1)*math.tau/6
                    a.face('flower',[(cx,cy+.04,cz),(cx+math.cos(aa)*.11,cy,cz+math.sin(aa)*.11),(cx+math.cos((aa+bb)/2)*.15,cy+.04,cz+math.sin((aa+bb)/2)*.15),(cx+math.cos(bb)*.11,cy,cz+math.sin(bb)*.11)])
        for xx in [1.0,10.8]:
            box('steel',xx,2.9,-.23,.045,.045,.42)
            lathe('steel',x+xx,z-.45,[(2.47,.16),(2.51,.16),(2.76,.13),(2.89,.22),(2.98,0)],8)
            lathe('lamp_warm',x+xx,z-.45,[(2.52,.12),(2.77,.10)],8)
    return len(plan['buildings'])
