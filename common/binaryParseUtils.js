/*
Copyright (c) 2011, Children's Hospital Boston
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the Children's Hospital Boston nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL CHILDREN'S HOSPITAL BOSTON BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
// The binary parsing code is adapted from the Three.js library:
//   https://github.com/mrdoob/three.js/blob/master/src/extras/io/Loader.js
function parseString( data, offset, length ) {

    return data.substr( offset, length );

}

function parseFloat32( data, offset ) {

    var b3 = parseUChar8( data, offset ),
    b2 = parseUChar8( data, offset + 1 ),
    b1 = parseUChar8( data, offset + 2 ),
    b0 = parseUChar8( data, offset + 3 ),

    sign = 1 - ( 2 * ( b0 >> 7 ) ),
    exponent = ((( b0 << 1 ) & 0xff) | ( b1 >> 7 )) - 127,
    mantissa = (( b1 & 0x7f ) << 16) | (b2 << 8) | b3;

    if (mantissa == 0 && exponent == -127)
        return 0.0;

    return sign * ( 1 + mantissa * Math.pow( 2, -23 ) ) * Math.pow( 2, exponent );

}

function parseFloat32EndianSwapped( data, offset ) {

    var b0 = parseUChar8( data, offset ),
    b1 = parseUChar8( data, offset + 1 ),
    b2 = parseUChar8( data, offset + 2 ),
    b3 = parseUChar8( data, offset + 3 ),

    sign = 1 - ( 2 * ( b0 >> 7 ) ),
    exponent = ((( b0 << 1 ) & 0xff) | ( b1 >> 7 )) - 127,
    mantissa = (( b1 & 0x7f ) << 16) | (b2 << 8) | b3;

    if (mantissa == 0 && exponent == -127)
        return 0.0;

    return sign * ( 1 + mantissa * Math.pow( 2, -23 ) ) * Math.pow( 2, exponent );

}

function parseFloat32Array( data, offset, elements) {
    var arr = new Array();
    for (i = 0; i < elements; i++)
    {
        var val = parseFloat32(data, offset + (i * 4));
        arr[i] = val;
    }

    return arr;
}


function parseUInt32( data, offset ) {

    var b0 = parseUChar8( data, offset ),
    b1 = parseUChar8( data, offset + 1 ),
    b2 = parseUChar8( data, offset + 2 ),
    b3 = parseUChar8( data, offset + 3 );

    return (b3 << 24) + (b2 << 16) + (b1 << 8) + b0;
}

function parseUInt32EndianSwapped( data, offset ) {

    var b0 = parseUChar8( data, offset ),
    b1 = parseUChar8( data, offset + 1 ),
    b2 = parseUChar8( data, offset + 2 ),
    b3 = parseUChar8( data, offset + 3 );

    return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
}


function parseUInt24EndianSwapped( data, offset ) {

    var b0 = parseUChar8( data, offset ),
        b1 = parseUChar8( data, offset + 1 ),
        b2 = parseUChar8( data, offset + 2 );


    return ((b0 << 16) + (b1 << 8) + (b2)) & 0x00FFFFFF;
}

function parseUInt16( data, offset ) {

    var b0 = parseUChar8( data, offset ),
    b1 = parseUChar8( data, offset + 1 );

    return (b1 << 8) + b0;

}

function parseUInt16Array( data, offset, elements) {
    var arr = new Array();
    for (i = 0; i < elements; i++)
    {
        var val = parseUInt16(data, offset + (i * 2));
        arr[i] = val;
    }

    return arr;
}

function parseSChar8( data, offset ) {

    var b = parseUChar8( data, offset );
    return b > 127 ? b - 256 : b;

}

function parseUChar8( data, offset ) {

    return data.charCodeAt( offset ) & 0xff;
}


