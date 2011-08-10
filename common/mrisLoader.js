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
//
//  mrisLoader.js
//
//  Description:
//      Provides a loader for FreeSurfer surface files
//      in JavaScript.  Ideas for this code were taken from three.js
//      at https://github.com/mrdoob/three.js.
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//

VolumeGeometry = function ()
{
    /*
    this.valid = 0;
    this.width = 0;
    this.height = 0;
    this.depth = 0;
    this.xsize = 0;
    this.ysize = 0;
    this.zsize = 0;
    this.x_r = 0.0;
    this.x_a = 0.0;
    this.x_s = 0.0;
    this.y_r = 0.0;
    this.y_a = 0.0;
    this.y_s = 0.0;
    this.z_r = 0.0;
    this.z_a = 0.0;
    this.z_s = 0.0;
    this.c_r = 0.0;
    this.c_a = 0.0;
    this.c_s = 0.0;
    */
   //@TEMP - should read this from file, for demoing' hardcoded for the particular
   //        surface I am using.
    //extent  : (256, 256, 256)
    // voxel   : ( 1.0000,  1.0000,  1.0000)
    // x_(ras) : (-1.0000,  0.0000,  0.0000)
    // y_(ras) : ( 0.0000,  0.0000, -1.0000)
    // z_(ras) : ( 0.0000,  1.0000,  0.0000)
    // c_(ras) : (-2.7213, 18.9737,  7.0585)
    this.valid = 1;
    this.width = 256;
    this.height = 256;
    this.depth = 256;
    this.xsize = 1.0;
    this.ysize = 1.0;
    this.zsize = 1.0;
    this.x_r = -1.0;
    this.x_a = 0.0;
    this.x_s = 0.0;
    this.y_r = 0.0;
    this.y_a = 0.0;
    this.y_s = -1.0;
    this.z_r = 0.0;
    this.z_a = 1.0;
    this.z_s = 0.0;
    this.c_r = 0.6794;
    this.c_a = 13.3063;
    this.c_s = 16.1304;
   //@TEMP
}

//  Represents the entire TrackFile, contains all of the
//  Tracks along with the data pre-processed for rendering
MRISFile = function()
{
    this.numVertices = 0;
    this.numFaces = 0;

    this.vertexPositions = null;
    this.vertexNormals = null;
    this.vertexNormalCount = null;
    this.vertexIndices = null;

    this.vertexPositionBuffer = null;
    this.vertexNormalBuffer = null;

    // Center of the object
    this.centerVect = new Float32Array(3);

    // Scale of the object
    this.scaleVect = new Float32Array(3);

    // Volume geometry
    this.vg = new VolumeGeometry();


}

MRISLoader = function()
{
}

// MRISLoader object
MRISLoader.prototype =
{
    // Load a MRIS file, provide a callback that handles loading
    // the data to WebGL
    load: function(mrisURL, callback, object)
    {
        var self = this;
        var xhr = new XMLHttpRequest();
        var length = 0;
        xhr.onreadystatechange = function()
        {
            if (xhr.readyState == 4)
            {
                if ( xhr.status == 200 || xhr.status == 0 )
                {
                    MRISLoader.prototype.loadMRISFile( xhr.responseText, callback, object );
                }
                else
                {
                    alert( "Couldn't load [" + url + "] [" + xhr.status + "]" );
                }
            }            
        }
        xhr.open("GET", mrisURL, true);
        xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.send(null);
    },

    // Internal function, initiates loading and processing the MRIS file
    loadMRISFile: function(data, callback, object)
    {
        var mrisFile = new MRISFile();
        var currentOffset = 0;
        
        var magic = parseString( data, currentOffset, 3 );
        currentOffset += 3;

        // Go through two newlines
        var iters = 0;
        var curChar;
        do
        {
            curChar = parseUChar8( data, currentOffset++ );
            iters++;
        }
        while ((iters < 200) && (curChar != 0x0A))

        // Read one more newline
        curChar = parseUChar8( data, currentOffset++ );
        
        mrisFile.numVertices = parseUInt32EndianSwapped( data, currentOffset );
        currentOffset += 4;
        console.log('Vertices: ' + mrisFile.numVertices)

        mrisFile.numFaces = parseUInt32EndianSwapped( data, currentOffset );
        currentOffset += 4;

        mrisFile.vertexPositions = new Float32Array( mrisFile.numVertices * 3 );
        mrisFile.vertexNormals = new Float32Array( mrisFile.numVertices * 3 );
        mrisFile.vertexNormalCount = new Int32Array( mrisFile.numVertices );
        for (var v = 0; v < mrisFile.numVertices; v++)
        {
            mrisFile.vertexPositions[v * 3 + 0] = parseFloat32EndianSwapped( data, currentOffset );
            mrisFile.vertexNormals[v * 3 + 0] = 0.0;
            currentOffset += 4;
            mrisFile.vertexPositions[v * 3 + 1] = parseFloat32EndianSwapped( data, currentOffset );
            mrisFile.vertexNormals[v * 3 + 1] = 0.0;
            currentOffset += 4;
            mrisFile.vertexPositions[v * 3 + 2] = parseFloat32EndianSwapped( data, currentOffset );
            mrisFile.vertexNormals[v * 3 + 2] = 0.0;            
            currentOffset += 4;

            mrisFile.vertexNormalCount[v] = 0;
        }

        // Read teh faces and compute the average vertex normal for each vertex
        mrisFile.vertexIndices = new Int32Array( mrisFile.numFaces * 3 );
        for (var f = 0; f < mrisFile.numFaces; f++)
        {
            for (var n = 0; n < 3; n++)
            {
                mrisFile.vertexIndices[f * 3 + n] = parseUInt32EndianSwapped( data, currentOffset );
                mrisFile.vertexNormalCount[mrisFile.vertexIndices[f * 3 + n]] += 1;
                currentOffset += 4;
            }

            var index;

            // Compute the face normal
            index = mrisFile.vertexIndices[f * 3 + 0];
            var v0 = Vector.create([mrisFile.vertexPositions[(index * 3) + 0],
                                    mrisFile.vertexPositions[(index * 3) + 1],
                                    mrisFile.vertexPositions[(index * 3) + 2]]);

            index = mrisFile.vertexIndices[f * 3 + 1];
            var v1 = Vector.create([mrisFile.vertexPositions[(index * 3) + 0],
                                    mrisFile.vertexPositions[(index * 3) + 1],
                                    mrisFile.vertexPositions[(index * 3) + 2]]);

            index = mrisFile.vertexIndices[f * 3 + 2];
            var v2 = Vector.create([mrisFile.vertexPositions[(index * 3) + 0],
                                    mrisFile.vertexPositions[(index * 3) + 1],
                                    mrisFile.vertexPositions[(index * 3) + 2]]);
            
            var n0 = v1.subtract(v0);
            var n1 = v2.subtract(v1);

            var normal = n0.cross(n1).toUnitVector();

            // Add the face normal to each of the three vertices
            index = mrisFile.vertexIndices[f * 3 + 0];
            mrisFile.vertexNormals[(index * 3) + 0] += normal.elements[0];
            mrisFile.vertexNormals[(index * 3) + 1] += normal.elements[1];
            mrisFile.vertexNormals[(index * 3) + 2] += normal.elements[2];

            index = mrisFile.vertexIndices[f * 3 + 1];
            mrisFile.vertexNormals[(index * 3) + 0] += normal.elements[0];
            mrisFile.vertexNormals[(index * 3) + 1] += normal.elements[1];
            mrisFile.vertexNormals[(index * 3) + 2] += normal.elements[2];

            index = mrisFile.vertexIndices[f * 3 + 2];
            mrisFile.vertexNormals[(index * 3) + 0] += normal.elements[0];
            mrisFile.vertexNormals[(index * 3) + 1] += normal.elements[1];
            mrisFile.vertexNormals[(index * 3) + 2] += normal.elements[2];
        }

        // Now average all the normals
        for (v = 0; v < mrisFile.numVertices; v++)
        {
            mrisFile.vertexNormals[(v * 3) + 0] /= mrisFile.vertexNormalCount[v];
            mrisFile.vertexNormals[(v * 3) + 1] /= mrisFile.vertexNormalCount[v];
            mrisFile.vertexNormals[(v * 3) + 2] /= mrisFile.vertexNormalCount[v];
        }

        this.preprocessForRendering(mrisFile);
        
        callback(mrisFile, object);
    },


    // After loading the MRIS file, preprocess the data into
    // arrays that can be used for rendering it using WebGL
    preprocessForRendering: function (mrisFile)
    {
        console.log('Begin postprocessing...');
        var vertIdx = 0;
        var elemIdx = 0;

        mrisFile.vertexPositionBuffer = new Float32Array(mrisFile.numFaces * 3 * 3);
        mrisFile.vertexNormalBuffer = new Float32Array(mrisFile.numFaces * 3 * 3);
        console.log('Allocated memory.');

        var min = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE];
        var max = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];

        var index = 0;
        var normalIndex = 0;
        for (var f = 0; f < mrisFile.numFaces; f++)
        {
            for (var n = 0; n < 3; n++)
            {
                for (var p = 0; p < 3; p++)
                {
                    mrisFile.vertexPositionBuffer[index] =
                        mrisFile.vertexPositions[(mrisFile.vertexIndices[f * 3 + n] * 3) + p];
                    mrisFile.vertexNormalBuffer[index] =
                        mrisFile.vertexNormals[(mrisFile.vertexIndices[f * 3 + n] * 3) + p];
                    
                    if (min[p] > mrisFile.vertexPositionBuffer[index] )
                        min[p] = mrisFile.vertexPositionBuffer[index];
                    if (max[p] < mrisFile.vertexPositionBuffer[index] )
                        max[p] = mrisFile.vertexPositionBuffer[index];
                    
                    index++;
                }

            }
        }

        for (var idx = 0; idx < 3; idx++)
        {
            mrisFile.centerVect[idx] = (max[idx] - min[idx]) / 2.0 + min[idx];
            mrisFile.scaleVect[idx] = 1.0 / (max[idx] - min[idx]);
        }
    }
}


// Transformation utility functions
function MRIxfmCRS2XYZ(mri)
{
    var m = Matrix.I(4);

    /* direction cosine between columns scaled by
     distance between colums */
    m.elements[0][0] = mri.x_r * mri.xsize;
    m.elements[1][0] = mri.x_a * mri.xsize;
    m.elements[2][0] = mri.x_s * mri.xsize;

    /* direction cosine between rows scaled by
     distance between rows */
    m.elements[0][1] = mri.y_r * mri.ysize;
    m.elements[1][1] = mri.y_a * mri.ysize;
    m.elements[2][1] = mri.y_s * mri.ysize;

    /* direction cosine between slices scaled by
     distance between slices */
    m.elements[0][2] = mri.z_r * mri.zsize;
    m.elements[1][2] = mri.z_a * mri.zsize;
    m.elements[2][2] = mri.z_s * mri.zsize;

    /* Preset the offsets to 0 */
    m.elements[0][3] = 0.0;
    m.elements[1][3] = 0.0;
    m.elements[2][3] = 0.0;

    /* Last row of matrix */
    m.elements[3][0] = 0.0;
    m.elements[3][1] = 0.0;
    m.elements[3][2] = 0.0;
    m.elements[3][3] = 1.0;

    /* At this point, m = Mdc * D */
    /* Col, Row, Slice at the Center of the Volume */
    var Pcrs = $V([0.0, 0.0, 0.0, 0.0]);
    Pcrs.elements[0] = mri.width / 2.0;
    Pcrs.elements[1] = mri.height / 2.0;
    Pcrs.elements[2] = mri.depth / 2.0;
    Pcrs.elements[3] = 1.0;

    /* XYZ offset the first Col, Row, and Slice from Center */
    /* PxyzOffset = Mdc*D*PcrsCenter */
    var PxyzOffset = m.multiply(Pcrs);

    /* XYZ at the Center of the Volume is mri.c_r, c_a, c_s  */

    /* The location of the center of the voxel at CRS = (0,0,0)*/
    m.elements[0][3] = mri.c_r - PxyzOffset.elements[0];
    m.elements[1][3] = mri.c_a - PxyzOffset.elements[1];
    m.elements[2][3] = mri.c_s - PxyzOffset.elements[2];

    return(m);
}

function MRIxfmCRS2XYZtkreg(mri)
{
    var tmp = new VolumeGeometry();

    tmp.width = mri.width;
    tmp.height = mri.height;
    tmp.depth = mri.depth;

    /* Set tkregister defaults */
    /* column         row           slice          center      */
    tmp.x_r = -1;
    tmp.y_r =  0;
    tmp.z_r =  0;
    tmp.c_r = 0.0;
    tmp.x_a =  0;
    tmp.y_a =  0;
    tmp.z_a =  1;
    tmp.c_a = 0.0;
    tmp.x_s =  0;
    tmp.y_s = -1;
    tmp.z_s =  0;
    tmp.c_s = 0.0;

    /* Copy the voxel resolutions */
    tmp.xsize = mri.xsize;
    tmp.ysize = mri.ysize;
    tmp.zsize = mri.zsize;

    var K = MRIxfmCRS2XYZ(tmp);

    return(K);
}

function surfaceRASFromRAS(mri)
{
  var sRASFromRAS;
  var Vox2TkRAS;
  var Vox2RAS;

  Vox2RAS = MRIxfmCRS2XYZ(mri); // scanner vox2ras
  Vox2TkRAS = MRIxfmCRS2XYZtkreg(mri); // tkreg vox2ras
  // sRASFromRAS = Vox2TkRAS * inv(Vox2RAS)
  sRASFromRAS = Vox2RAS.inverse();
  sRASFromRAS =  Vox2TkRAS.multiply(sRASFromRAS);//MatrixMultiply(Vox2TkRAS,sRASFromRAS,sRASFromRAS);
  return(sRASFromRAS);
}

function RASFromSurfaceRAS(mri)
{
  var RASFromsRAS;
  var Vox2TkRAS;
  var Vox2RAS;

  Vox2RAS = MRIxfmCRS2XYZ(mri); // scanner vox2ras
  Vox2TkRAS = MRIxfmCRS2XYZtkreg(mri); // tkreg vox2ras
  RASFromsRAS = Vox2TkRAS.inverse();
  RASFromsRAS = Vox2RAS.multiply(RASFromsRAS);
  return(RASFromsRAS);
}
