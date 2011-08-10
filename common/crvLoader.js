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


//  Represents the entire curvature file, contains all of the
//  Tracks along with the data pre-processed for rendering
CRVFile = function()
{
    this.numVertices = 0;

    this.minCurv = new Float32Array(2);
    this.maxCurv = new Float32Array(2);

    this.posMean = 0.0;
    this.negMean = 0.0;
    this.posStdDev = 0.0;
    this.negStdDev = 0.0;
    this.mean = 0.0;
    this.stdDev = 0.0;

    this.vertexCurvatures = null;
    this.vertexCurvatureBuffer = null;
}

CRVLoader = function()
{
}

// CRVLoader object
CRVLoader.prototype =
{
    // Load a CRV file, provide a callback that handles loading
    // the data to WebGL
    load: function(crvURL, mrisFile, callback, object)
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
                    CRVLoader.prototype.loadCRVFile( xhr.responseText, mrisFile, callback, object );
                }
                else
                {
                    alert( "Couldn't load [" + url + "] [" + xhr.status + "]" );
                }
            }
        }
        xhr.open("GET", crvURL, true);
        xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.send(null);
    },

    // Internal function, initiates loading and processing the CRV file
    loadCRVFile: function(data, mrisFile, callback, object)
    {
        var crvFile = new CRVFile();
        var currentOffset = 0;

        var magicNumber = parseUInt24EndianSwapped( data, currentOffset );
        currentOffset += 3;

        // This hackery is the fact that the new version defines this
        // as a magic number to identify the new file type
        if (magicNumber != 16777215)
        {
            alert( "Can't load curvature file, invalid magic number.");
            return;
        }
        
        crvFile.numVertices = parseUInt32EndianSwapped( data, currentOffset );
        console.log('Vertices: ' + crvFile.numVertices)

        currentOffset += 4;
        var fnum = parseUInt32EndianSwapped( data, currentOffset );
        currentOffset += 4;
        var valsPerVertex = parseUInt32EndianSwapped( data, currentOffset );
        currentOffset += 4;


        var numPosValues = 0;
        var numNegValues = 0;
        var negSum = 0.0;
        var posSum = 0.0;
        var sum = 0.0;
        var numValues = 0;
        crvFile.vertexCurvatures = new Float32Array( crvFile.numVertices );
        for( var k = 0; k < crvFile.numVertices; k++ )
        {
            var curv = parseFloat32EndianSwapped( data, currentOffset );
            currentOffset += 4;
            if ( k == 0 )
            {
                crvFile.minCurv[0] = crvFile.maxCurv[0] = curv;
            }
            if (curv >= 0.0)
            {
                numPosValues++;
                posSum += curv;
            }
            else
            {
                numNegValues++;
                negSum += curv;
            }

            sum += curv;
            numValues++;

            if ( curv > crvFile.maxCurv[0] )
                crvFile.maxCurv[0] = curv;

            if ( curv < crvFile.minCurv[0] )
                crvFile.minCurv[0] = curv;

            crvFile.vertexCurvatures[k] = curv;
        }

        if (numPosValues == 0)
        {
            crvFile.posMean = 0;
        }
        else
        {
            crvFile.posMean = posSum / numPosValues;
        }

        if (numNegValues == 0)
        {
            crvFile.negMean = 0;
        }
        else
        {
            crvFile.negMean = negSum / numNegValues;
        }

        if (numValues == 0)
        {
            crvFile.mean = 0;
        }
        else
        {
            crvFile.mean = sum / numValues;
        }


        posSum = 0.0;
        negSum = 0.0;
        sum = 0.0;
        for (var i = 0; i < crvFile.numVertices; i++)
        {
            var curv = crvFile.vertexCurvatures[i];
            var diffSq;
            if (curv >= 0.0)
            {
                diffSq = Math.pow((curv - crvFile.posMean), 2);
                posSum += diffSq;
            }
            else
            {
                diffSq = Math.pow((curv - crvFile.negMean), 2);
                negSum += diffSq;
            }

            diffSq = Math.pow((curv - crvFile.mean), 2);
            sum += diffSq;
        }

        if (numPosValues > 1)
        {
            crvFile.posStdDev = Math.sqrt(posSum / (numPosValues - 1));
        }
        else
        {
            crvFile.posStdDev = 0;
        }

        if (numNegValues > 1)
        {
            crvFile.negStdDev = Math.sqrt(negSum / (numNegValues - 1));
        }
        else
        {
            crvFile.negStdDev = 0;
        }

        if (numValues > 1)
        {
            crvFile.stdDev = Math.sqrt(sum / (numValues - 1));
        }
        else
        {
            crvFile.stdDev = 0;
        }

        

        // Store also 2.5 standard deviations from each mean.  This is
        // a more reasonable range to render with
        crvFile.minCurv[1] = crvFile.negMean - 2.5 * crvFile.negStdDev;
        crvFile.maxCurv[1] = crvFile.posMean + 2.5 * crvFile.posStdDev;
        
        this.preprocessForRendering(crvFile, mrisFile);

        callback(crvFile, object);
    },


    // After loading the CRV file, preprocess the data into
    // arrays that can be used for rendering it using WebGL
    preprocessForRendering: function (crvFile, mrisFile)
    {
        

        // Unroll the curvatures by face indices to match the MRIS.
        // We have to do this because of the WebGL limitation of ushort
        // indices.  THe other alternative is to chunk the mesh up (which
        // would be more efficient), but at the moment this is the easiest
        // thing to do.
        crvFile.vertexCurvatureBuffer = new Float32Array(mrisFile.numFaces * 3);

        var index = 0;
        for (var f = 0; f < mrisFile.numFaces; f++)
        {
            for (var n = 0; n < 3; n++)
            {                
                crvFile.vertexCurvatureBuffer[index] =
                    crvFile.vertexCurvatures[mrisFile.vertexIndices[f * 3 + n]];
                    
                index++;
            }
            
        }

       
    }
}
