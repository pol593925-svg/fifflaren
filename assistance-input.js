'use strict';
// Compile once. Input dispatch runs in C#, avoiding PowerShell/JSON overhead for every move.
module.exports=String.raw`$ErrorActionPreference='Stop'
Add-Type -ReferencedAssemblies System.Web.Extensions -TypeDefinition @'
using System;using System.Collections.Generic;using System.Runtime.InteropServices;using System.Web.Script.Serialization;using System.Threading;using System.Text;
public static class HubInput {
 [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT {public int x,y;public uint data,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Explicit)] public struct UNION {[FieldOffset(0)] public MOUSEINPUT mouse;[FieldOffset(0)] public KEYBDINPUT key;}
 [StructLayout(LayoutKind.Sequential)] public struct INPUT {public uint type;public UNION u;}
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint n,INPUT[] a,int size);
 static object gate=new object();static HashSet<int> held=new HashSet<int>();static DateTime touched=DateTime.UtcNow;
 static void Send(INPUT[] a){if(a.Length>0)SendInput((uint)a.Length,a,Marshal.SizeOf(typeof(INPUT)));}
 static INPUT K(int vk,bool up){INPUT i=new INPUT();i.type=1;i.u.key.vk=(ushort)vk;i.u.key.flags=up?2u:0u;if(vk==33||vk==34||vk==35||vk==36||vk==37||vk==38||vk==39||vk==40||vk==45||vk==46||vk==91||vk==93)i.u.key.flags|=1;return i;}
 static INPUT M(uint flags,uint data){INPUT i=new INPUT();i.u.mouse.flags=flags;i.u.mouse.data=data;return i;}
 static uint Flag(int button,bool up){return button==0?(up?4u:2u):button==1?(up?64u:32u):(up?16u:8u);}
 static int N(Dictionary<string,object>d,string k){return d.ContainsKey(k)?Convert.ToInt32(d[k]):0;}
 static bool B(Dictionary<string,object>d,string k){return d.ContainsKey(k)&&Convert.ToBoolean(d[k]);}
 static void Release(){foreach(int b in held)Send(new INPUT[]{M(Flag(b,true),0)});held.Clear();}
 static int[] Modifiers(Dictionary<string,object>d){List<int> m=new List<int>();if(B(d,"ctrl"))m.Add(17);if(B(d,"alt"))m.Add(18);if(B(d,"shift"))m.Add(16);if(B(d,"meta"))m.Add(91);return m.ToArray();}
 static void WithMods(Dictionary<string,object>d,Action action){int[] m=Modifiers(d);try{foreach(int k in m)Send(new INPUT[]{K(k,false)});action();}finally{for(int j=m.Length-1;j>=0;j--)Send(new INPUT[]{K(m[j],true)});}}
 public static void Run(){
  SetProcessDPIAware();
  Console.InputEncoding=new UTF8Encoding(false);Console.OutputEncoding=new UTF8Encoding(false);
  JavaScriptSerializer json=new JavaScriptSerializer();json.MaxJsonLength=100000;
  Console.WriteLine("READY");
  using(Timer timer=new Timer(delegate(object o){lock(gate){if((DateTime.UtcNow-touched).TotalSeconds>5)Release();}},null,1000,1000)){
   try{string line;while((line=Console.ReadLine())!=null){try{
    Dictionary<string,object>d=json.Deserialize<Dictionary<string,object>>(line);string kind=Convert.ToString(d["kind"]);
    lock(gate){touched=DateTime.UtcNow;
     if(kind=="probe"){Console.WriteLine("OK INPUT_SIZE="+Marshal.SizeOf(typeof(INPUT)));continue;}
     if(kind=="release"){Release();continue;}
     if(kind=="text"){
      string text=Convert.ToString(d["text"]);if(text.Length>256)continue;
      List<INPUT> chars=new List<INPUT>();foreach(char ch in text){INPUT down=new INPUT();down.type=1;down.u.key.scan=ch;down.u.key.flags=4;chars.Add(down);down.u.key.flags=6;chars.Add(down);}Send(chars.ToArray());continue;
     }
     if(kind=="key"){int vk=N(d,"vk");if(vk<1||vk>254)continue;WithMods(d,delegate(){Send(new INPUT[]{K(vk,false),K(vk,true)});});continue;}
     if(kind!="move"&&kind!="down"&&kind!="up"&&kind!="click"&&kind!="right"&&kind!="wheel")continue;
     SetCursorPos(N(d,"x"),N(d,"y"));
     if(kind=="down"||kind=="up"){int button=N(d,"button");if(button<0||button>2)continue;bool up=kind=="up";if(up&&!held.Contains(button))continue;WithMods(d,delegate(){Send(new INPUT[]{M(Flag(button,up),0)});});if(up)held.Remove(button);else held.Add(button);}
     if(kind=="click"||kind=="right"){int b=kind=="right"?2:0;WithMods(d,delegate(){Send(new INPUT[]{M(Flag(b,false),0),M(Flag(b,true),0)});});}
     if(kind=="wheel")Send(new INPUT[]{M(2048,unchecked((uint)(N(d,"delta")*120)))});
    }
   }catch{Console.WriteLine("INPUT_ERROR");}}
   }finally{lock(gate){Release();}}
  }
 }
}
'@
[HubInput]::Run()
`;
