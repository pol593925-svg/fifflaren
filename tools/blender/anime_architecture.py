"""Curved roof wings and habitable townhouses; consumes the same collision plan as the server."""
import json, math, subprocess, bmesh
from mathutils import Vector

def build(a,theme):
    plan=json.loads(subprocess.check_output(['node',str(a.ROOT/'tools/export-coast-buildings.cjs'),theme],cwd=a.ROOT,encoding='utf8'))
    rounded_cache={}
    def rounded_box(mat,x,y,z,w,h,d,radius=.055):
        if min(w,h,d)<.075:return a.box(mat,x,y,z,w,h,d)
        key=(w,h,d,min(radius,min(w,h,d)*.23))
        if key not in rounded_cache:
            bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
            for v in bm.verts:v.co=Vector((v.co.x*w,v.co.y*h,v.co.z*d))
            bmesh.ops.bevel(bm,geom=list(bm.edges),offset=key[3],segments=2,affect='EDGES')
            rounded_cache[key]=[[tuple(v.co) for v in f.verts]for f in bm.faces];bm.free()
        for face in rounded_cache[key]:a.face(mat,[(x+xx,y+yy,z+zz)for xx,yy,zz in face])
    def tube(mat,points,r=.04,sides=8):
        rings=[]
        for j,p in enumerate(points):
            tangent=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
            u=tangent.cross(Vector((0,0,1)))
            if u.length<.01:u=tangent.cross(Vector((1,0,0)))
            u.normalize();v=tangent.cross(u).normalized()
            rings.append([tuple(Vector(p)+r*(u*math.cos(k*math.tau/sides)+v*math.sin(k*math.tau/sides))) for k in range(sides)])
        for left,right in zip(rings,rings[1:]):
            for k in range(sides):a.face(mat,[left[k],right[k],right[(k+1)%sides],left[(k+1)%sides]])
    finishes={'wall':'plaster_light','floor':'wood','roof':'limestone','step':'wood','rail':'plaster','trim':'trim','wood':'wood','fabric':'shutter'}
    building_origins={b['id']:(b['x'],b['z']) for b in plan['buildings']}
    for box in plan['boxes']:
        if box.get('animeRoof'):continue
        lo,hi=box['min'],box['max'];kind=box.get('kind','wall');mat=finishes.get(kind,'limestone')
        if kind=='wall':mat=['plaster_light','plaster_blue','plaster'][box.get('building',0)%3]
        origin=building_origins.get(box.get('building'))
        if kind=='rail' and origin and lo[2]<origin[1] and hi[0]-lo[0]>7:
            # A continuous bowed moulding stays inside the original solid parapet envelope.
            # Keep its collision/cover volume; sculpt its face instead of adding open balusters.
            for j in range(24):
                u=j/24;v=(j+1)/24
                for k in range(4):
                    t=k/4;tt=(k+1)/4
                    def point(s,r,back=False):
                        xx=lo[0]+s*(hi[0]-lo[0]);yy=lo[1]+r*(hi[1]-lo[1])
                        zz=hi[2] if back else lo[2]+.042*(1-math.sin(r*math.pi))*math.sin(s*math.pi)**.4
                        return (xx,yy,zz)
                    a.face('wood',[point(u,t),point(v,t),point(v,tt),point(u,tt)])
                for t in [0,1]:a.face('trim',[point(u,t),point(u,t,True),point(v,t,True),point(v,t)])
            a.face('wood',[point(0,0,True),point(0,1,True),point(1,1,True),point(1,0,True)])
            for s in [0,1]:a.face('trim',[point(s,0),point(s,1),point(s,1,True),point(s,0,True)])
            continue
        draw=rounded_box if kind in ['trim','rail','wood','fabric'] else a.box
        draw(mat,*[(x+y)/2 for x,y in zip(lo,hi)],*[y-x for x,y in zip(lo,hi)])
    def lathe(mat,x,z,rings,n=16):
        for (y,r),(yy,rr) in zip(rings,rings[1:]):
            for j in range(n):
                p,q=j*math.tau/n,(j+1)*math.tau/n
                a.face(mat,[(x+math.cos(p)*r,y,z+math.sin(p)*r),(x+math.cos(q)*r,y,z+math.sin(q)*r),(x+math.cos(q)*rr,yy,z+math.sin(q)*rr),(x+math.cos(p)*rr,yy,z+math.sin(p)*rr)])
    def ribbon(mat,points,width):
        for p,q in zip(points,points[1:]):
            a.face(mat,[(p[0],p[1]-width,p[2]),(q[0],q[1]-width,q[2]),(q[0],q[1]+width,q[2]),(p[0],p[1]+width,p[2])])
    def flower(cx,cy,cz,r=.10):
        for k in range(6):
            aa=(k+.5)*math.tau/6
            petal=[(cx,cy,cz-.04)]
            for j in range(9):
                t=j/8*math.pi;length=math.sin(t*.5)*r*1.5;angle=aa+math.cos(t)*.42
                petal.append((cx+math.cos(angle)*length,cy+math.sin(angle)*length,cz-.05*math.sin(t)))
            a.face('flower',petal)
    for b in plan['buildings']:
        x,z=b['x'],b['z'];bid=b['id']
        def box(mat,xx,y,zz,w,h,d):rounded_box(mat,x+xx,y,z+zz,w,h,d)
        def height(u):
            q=max(0,min(96,(u-.15)/8.7*96));i=min(95,int(q));t=q-i
            return plan['roofProfile'][i]*(1-t)+plan['roofProfile'][i+1]*t
        # A curved gable over the front wing gives a true silhouette. Rear rooftop is a terrace.
        for j in range(96):
            u=.15+j*8.7/96;v=u+8.7/96
            for k in range(14):
                zz=-.25+k*5.5/14;end=zz+5.5/14
                # Raised overlapping ceramic courses, welded and smooth-shaded at export.
                # Small barrel-tile relief stays within the 6cm gameplay roof tolerance.
                tile=lambda q:.026*(1+math.cos((q-.15)/.54375*math.tau))*.5
                lift=.009*(k%2)
                a.face('roof',[(x+u,height(u)+tile(u)+lift,z+zz),(x+u,height(u)+tile(u)+lift,z+end),
                    (x+v,height(v)+tile(v)+lift,z+end),(x+v,height(v)+tile(v)+lift,z+zz)],tint=.91+(k%3)*.035)
            for zz in [-.25,5.25]:
                a.face(['plaster_light','plaster_blue','plaster'][bid%3],[(x+u,7.18,z+zz),(x+v,7.18,z+zz),(x+v,height(v),z+zz),(x+u,height(u),z+zz)])
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
        # Side elevations receive the same carved masonry as the front, keeping windows clear.
        for sx in [-.055,12.055]:
            for yy in [.20,.65,3.42,6.88]:box('trim',sx,yy,6,.12,.10,11.45)
            for zz in [1.05,5.80,10.80]:
                box('wood',sx,5.28,zz,.11,2.90,.095)
        for zz in [3.2,8.5]:
            for yy in [2.50,6.10]:
                tube('trim',[(x+12.12,yy+.20*math.sin(j*math.pi/24),z+zz-1.02+j*2.04/24)for j in range(25)],.055)
        # A cloth guild banner dresses the solid side wall; geometry waves only at authoring time.
        for zz in [3.0,9.0]:
            box('wood',-.24,6.45,zz,.48,.075,1.44)
            for j in range(16):
                t=j/16;tt=(j+1)/16
                for k in range(8):
                    s=k/8;ss=(k+1)/8
                    def cloth(q,r):return (x-.15-.095*math.sin(q*math.pi*2+r*1.7),6.38-q*2.25,z+zz+(r-.5)*1.20)
                    a.face('roof' if k in [0,7] else 'shutter',[cloth(t,s),cloth(tt,s),cloth(tt,ss),cloth(t,ss)])
            # Shallow embroidered star in the plane of the banner.
            for j in range(8):
                aa=j*math.tau/8;bb=(j+1)*math.tau/8
                a.face('trim',[(x-.29,5.30,z+zz),(x-.29,5.30+math.cos(aa)*(.31 if j%2==0 else .13),z+zz+math.sin(aa)*(.31 if j%2==0 else .13)),
                    (x-.29,5.30+math.cos(bb)*(.13 if j%2==0 else .31),z+zz+math.sin(bb)*(.13 if j%2==0 else .31))])
        # Timber framing and carved brackets distinguish a townhouse from a plaster block.
        for xx in [.55,3.8,7.65,11.4]:
            box('wood',xx,5.27,-.08,.105,3.03,.12)
        for y in [3.15,6.61]:box('wood',6,y,-.065,11.45,.105,.12)
        # The low belt must stop at the jambs; a full-width beam crosses the playable doorway.
        for lo,hi in [(.275,3.80),(7.20,11.725)]:box('wood',(lo+hi)/2,.68,-.065,hi-lo,.105,.12)
        for xx in [1.65,9.05]:
            tube('wood',[(x+xx,3.32-.86*math.sin(j*math.pi/40),z-1.60+j*1.6/20)for j in range(21)],.065,10)
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
        # Striped, scalloped textile awning above the entry, with 2.7m clear headroom.
        for j in range(20):
            u=3.55+j*.20;v=u+.20;mat='roof' if (j//2+bid)%2 else 'trim'
            for k in range(8):
                t=k/8;tt=(k+1)/8
                h=lambda t:3.18-.26*t-.10*math.sin(t*math.pi)
                a.face(mat,[(x+u,h(t),z-t*1.62),(x+v,h(t),z-t*1.62),
                    (x+v,h(tt),z-tt*1.62),(x+u,h(tt),z-tt*1.62)])
            for k in range(4):
                q=k/4;qq=(k+1)/4
                a.face(mat,[(x+u+q*.20,2.93,z-1.62),(x+u+qq*.20,2.93,z-1.62),
                    (x+u+qq*.20,2.76-.07*math.sin(qq*math.pi),z-1.62),
                    (x+u+q*.20,2.76-.07*math.sin(q*math.pi),z-1.62)])
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
            # Carved arch sits above the actual opening, preserving the full firing aperture.
            for j in range(28):
                aa=j*math.pi/28;bb=(j+1)*math.pi/28
                a.face('trim',[(x+cx+math.cos(t)*rr,6.12+math.sin(t)*rr*.30,z-.23)
                    for t,rr in [(aa,1.08),(aa,1.22),(bb,1.22),(bb,1.08)]])
            tube('wood',[(x+cx-1.14+j*2.28/28,6.16+.34*math.sin(j*math.pi/28),z-.25)for j in range(29)],.025)
        # Sculpted scroll supports and rounded balcony rail, joined into the material batches.
        # Ivory oval insets break the broad balcony fascia into carved woodwork.
        for xx in [2.4,4.4,6.4,8.4]:
            tube('trim',[(x+xx+.68*math.cos(j*math.tau/32),3.94+.18*math.sin(j*math.tau/32),z-1.817)for j in range(33)],.018,6)
            for sign in [-1,1]:
                tube('trim',[(x+xx+(j/12-.5)*.62,3.94+sign*.08*math.sin(j*math.pi/12),z-1.835)for j in range(13)],.012,6)
        for xx in [1.6,9.15]:
            tube('wood',[(x+xx,2.98+.48*math.sin(j*math.pi/32),z-.10-j*1.5/32)for j in range(33)],.075)
        tube('trim',[(x+1.4+j*8/40,4.38,z-1.84)for j in range(41)],.085,12)
        # A shallow panelled frieze and inlaid medallions soften the broad upper wall.
        for cx in [2.5,6,9.5]:
            for j in range(24):
                aa=j*math.tau/24;bb=(j+1)*math.tau/24
                a.face('shutter',[(x+cx+math.cos(t)*r,6.66+math.sin(t)*r,z-.17)
                    for t,r in [(aa,.08),(aa,.13),(bb,.13),(bb,.08)]])
        # Balcony coping and curled metal balusters sit on existing solid parapet.
        box('trim',5.4,4.33,-1.8,8.25,.12,.24)
        for j in range(12):
            cx=x+1.8+j*.65
            points=[(cx+.18*math.sin(k*math.tau/24),4.55+.16*math.cos(k*math.tau/24),z-1.84)for k in range(25)]
            ribbon('steel',points,.017)
        # Wisteria drapes on the balcony; its lowest blossoms stay above the entry.
        for j in range(29):
            cx=x+1.65+j*.266;yy=4.38+.10*math.sin(j*.71)
            for k in range(3):
                dx=math.sin(j*2.4+k)*.16;dy=k*.14
                a.face('leaf',[(cx-.16,yy-dy,z-1.94),(cx+dx,yy+.12-dy,z-2.06),(cx+.18,yy-dy,z-1.94),(cx,yy-.07-dy,z-2.00)])
            if j%2==0:
                for k in range(4):flower(cx+math.sin(k*2.3)*.07,yy-.12-k*.15,z-2.07,.09-k*.01)
        # Climbing leaves live on solid corners, not across doors or shooting windows.
        for xx in [.35,11.65]:
            points=[(x+xx+.13*math.sin(j*.57),.6+j*.18,z-.15)for j in range(34)]
            ribbon('wood',points,.018)
            for j,(cx,yy,zz)in enumerate(points):
                s=-1 if j%2 else 1
                a.face('leaf',[(cx,yy,zz-.03),(cx+s*.23,yy+.03,zz-.08),(cx+s*.30,yy+.24,zz-.04),(cx+s*.06,yy+.18,zz-.02)])
                if j%7==0:flower(cx+s*.16,yy+.12,zz-.12,.10)
        # Continuous wooden stair stringers; the collision treads stay unchanged.
        for side in [9.06,10.31]:
            a.face('wood',[(x+side,.0,z+.5),(x+side,3.48,z+10.5),(x+side,3.67,z+10.5),(x+side,.20,z+.5)])
        for side in [10.44,11.68]:
            a.face('wood',[(x+side,3.48,z+10.5),(x+side,6.96,z+.5),(x+side,7.20,z+.5),(x+side,3.70,z+10.5)])
        # Rounded pale nosings make each timber tread readable without changing its height.
        for j in range(20):
            box('trim',9.6875,j*.18+.145,.5+j*.5+.025,1.375,.055,.05)
            box('trim',11.0625,3.6+j*.18+.145,10-j*.5+.475,1.375,.055,.05)
        # The return-flight rail hugs the existing side wall, leaving the narrow stairs clear.
        tube('wood',[(x+11.68,4.55+j*.18,z+10.3-j*.5)for j in range(18)],.045)
        # Dress the solid rear elevation as a timber-framed garden wall, not fake openings.
        for xx in [.45,4.1,7.9,11.55]:box('wood',xx,3.62,12.055,.12,6.50,.12)
        for yy in [.72,3.24,6.66]:box('wood',6,yy,12.055,11.30,.12,.12)
        for xx in [2.25,9.75]:
            for j in range(29):
                cx=x+xx+.32*math.sin(j*.55);yy=.75+j*.195
                a.face('leaf',[(cx-.16,yy,z+12.14),(cx-.09,yy+.20,z+12.20),
                    (cx+.20,yy+.14,z+12.16),(cx+.10,yy-.05,z+12.17)])
                if j%5==0:flower(cx,yy+.12,z+12.25,.12)
        # An original geometric sun crest breaks the blank rear plaster between the frames.
        for j in range(32):
            aa=j*math.tau/32;bb=(j+1)*math.tau/32
            a.face('trim',[(x+6+math.cos(t)*r,4.85+math.sin(t)*r,z+12.15)
                for t,r in [(aa,.70),(aa,.78),(bb,.78),(bb,.70)]])
        a.face('shutter',[(x+6,5.4,z+12.16),(x+6.4,4.85,z+12.16),
            (x+6,4.3,z+12.16),(x+5.6,4.85,z+12.16)])
        # Sculpted ceramic planters with petal rosettes, not flat triangular flowers.
        for xx,zz in [(.85,-.6),(10.8,-.6)]:
            lathe('ceramic',x+xx,z+zz,[(.03,.22),(.12,.28),(.35,.39),(.58,.32),(.63,.34),(.68,.34)],18)
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
