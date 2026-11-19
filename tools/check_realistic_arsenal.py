"""Offline GLB structure, LOD and real sight-seat checks, without a GPU."""
import json,struct,math
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SIZES={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
COUNTS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def inspect(path):
    data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);binary=data[28+n:]
    def accessor(index):
        a=j['accessors'][index];v=j['bufferViews'][a['bufferView']];dtype=SIZES[a['componentType']];columns=COUNTS[a['type']];stride=v.get('byteStride',np.dtype(dtype).itemsize*columns)
        return np.ndarray((a['count'],columns),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dtype).itemsize))
    def matrix(node):
        if 'matrix'in node:return np.array(node['matrix']).reshape(4,4).T
        x,y,z,w=node.get('rotation',[0,0,0,1]);m=np.eye(4)
        m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*w*z,2*x*z+2*w*y],[2*x*y+2*w*z,1-2*x*x-2*z*z,2*y*z-2*w*x],[2*x*z-2*w*y,2*y*z+2*w*x,1-2*x*x-2*y*y]])@np.diag(node.get('scale',[1,1,1]))
        m[:3,3]=node.get('translation',[0,0,0]);return m
    full=[];world=[];calls=[0,0];grip=None
    def visit(i,parent,isworld=False):
        nonlocal grip
        node=j['nodes'][i];isworld=isworld or node.get('name')=='worldLOD';m=parent@matrix(node)
        if node.get('extras',{}).get('cs16Grip'):grip=node['extras']['cs16Grip']
        if'mesh'in node:
            for p in j['meshes'][node['mesh']]['primitives']:
                points=accessor(p['attributes']['POSITION']);points=(np.pad(points,((0,0),(0,1)),constant_values=1)@m.T)[:,:3]
                assert np.isfinite(points).all(),(path.name,'nonfinite positions')
                indices=accessor(p['indices']).reshape(-1,3);tris=points[indices];(world if isworld else full).append(tris);calls[isworld]+=1
                assert'COLOR_0'not in p['attributes'],(path.name,'legacy vertex palette remains')
        for child in node.get('children',[]):visit(child,m,isworld)
    for i in j['scenes'][j.get('scene',0)]['nodes']:visit(i,np.eye(4))
    a=np.concatenate(full);b=np.concatenate(world);kind=path.stem.replace('anime-','')
    assert len(b)<=len(a)*.30,(kind,'world triangle budget',len(a),len(b))
    assert calls[1]<=2,(kind,'world draw budget',calls)
    lo=a.reshape(-1,3).min(axis=0);hi=a.reshape(-1,3).max(axis=0);low=b.reshape(-1,3).min(axis=0);high=b.reshape(-1,3).max(axis=0)
    assert max(np.linalg.norm(lo-low),np.linalg.norm(hi-high))<.035,(kind,'LOD bounds',lo-low,hi-high)
    result={'weapon':kind,'viewTriangles':len(a),'worldTriangles':len(b),'draws':calls,'bytes':len(data)}
    if kind not in ['knife','karambit','awp','scout']:
        pistol=kind in ['glock','usp','deagle','fiveseven','tec9','elite'];y=.052 if pistol else .216 if kind=='p90'else .18 if kind=='famas'else .09
        point=np.array(grip['rail']if grip else[.09 if kind=='elite'else 0,y,.009 if pistol else-.15 if kind=='p90'else-.045],dtype=float)
        # Barycentric intersection of downward ray with triangle's XZ projection.
        v0=a[:,0][:,[0,2]];e1=a[:,1][:,[0,2]]-v0;e2=a[:,2][:,[0,2]]-v0;v=point[[0,2]]-v0
        det=e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0];valid=np.abs(det)>1e-12;u=np.zeros(len(a));vv=u.copy()
        u[valid]=(v[valid,0]*e2[valid,1]-v[valid,1]*e2[valid,0])/det[valid];vv[valid]=(e1[valid,0]*v[valid,1]-e1[valid,1]*v[valid,0])/det[valid]
        valid&=(u>=-1e-5)&(vv>=-1e-5)&(u+vv<=1+1e-5)
        height=a[:,0,1]+u*(a[:,1,1]-a[:,0,1])+vv*(a[:,2,1]-a[:,0,1]);valid&=height<=point[1]+.012
        seat=float(height[valid].max())if valid.any()else None;result['railGapMetres']=None if seat is None else round(float(point[1]-seat),6)
        assert seat is not None and -.012<=point[1]-seat<.036,(kind,'floating reflex seat',result)
    return result
if __name__=='__main__':
    manifest=json.loads((ROOT/'models/csgo/anime-weapons-manifest.json').read_text())
    files=[ROOT/'models/csgo'/r['file']for r in manifest['assets']if r['file']!='anime-hands.glb']+[ROOT/'models/csgo/anime-karambit.glb']
    results=[inspect(p)for p in files]
    (ROOT/'graphics-qa/realistic-arsenal-static.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(results,indent=2));print('REALISTIC_ARSENAL_STATIC_PASS')
