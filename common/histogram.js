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
//  histogram.js
//
//  Description:
//      Compute and render a 2D histogram widget
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//

Histogram = function()
{

    // Create the VBOs
    this.vertexPositionBuffer = gl.createBuffer();
    this.elementIndexBuffer = gl.createBuffer();
    this.minMaxPositionBuffer = gl.createBuffer();

    this.histogram = null;
    this.histogramBins = 0.0;
    this.histogramMax = 0.0;
    this.histogramRange = [ 0.0, 0.0 ];
    

    // Initialize shaders
    this.fragShaderSrc =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +
        "uniform vec4 uColor;\n" +
        "void main(void) {\n" +
        "   gl_FragColor = vec4(uColor);\n" +
        "}\n";

    this.vertShaderSrc =
        "attribute vec3 aVertexPosition;\n" +
        
        "uniform mat4 uMVMatrix;\n" +
        "uniform mat4 uPMatrix;\n" +

        "void main(void) {\n" +
        "  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition.xyz, 1.0);\n" +        
        "}\n";


    var fragmentShader = compileShader(this.fragShaderSrc, gl.FRAGMENT_SHADER);
    var vertexShader = compileShader(this.vertShaderSrc, gl.VERTEX_SHADER);

    this.shaderProgram = gl.createProgram();
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);

    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(this.shaderProgram);

    this.shaderProgram.vertexPositionAttribute = gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
    
    this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
    this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
    this.shaderProgram.colorUniform = gl.getUniformLocation(this.shaderProgram, "uColor");
}

// Histogram object
Histogram.prototype =
{
    // Compute the internal histogram 
    computeHistogram: function(values, size, numBins, min, max)
    {
        this.histogram = new Float32Array(numBins);
        this.histogramBins = numBins;
        this.histogramMax = 0.0;
        this.histogramRange = [ min, max ];
        for (var bin = 0; bin < numBins; bin++)
        {
            this.histogram[bin] = 0.0;
        }

        var range = (max - min);
        for(var i = 0; i < size; i++)
        {
            var curValue = values[i];

            if (curValue >= min && curValue <= max)
            {
                var normalized = (curValue - min) / (max - min);
                var curBin = normalized * numBins;

                this.histogram[Math.floor(curBin)] += 1.0;
                if (this.histogram[Math.floor(curBin)] > this.histogramMax)
                    this.histogramMax = this.histogram[Math.floor(curBin)];
            }
        }

        // Generate the histogram geometry
        this.generateGeometry();
    },

    // Generate geometry for the histogram
    generateGeometry: function()
    { 
        var horizBarSize = 1.0 / this.histogramBins;
        var histVerts = new Float32Array(this.histogramBins * 4 * 2);
        var histIndices = new Uint16Array(this.histogramBins * 6);

        for(var i = 0; i < this.histogramBins; i++)
        {
            var horizOffsetLeft = (horizBarSize * i);
            var horizOffsetRight = (horizBarSize * (i + 1));
            var vertSize = this.histogram[i] / this.histogramMax;
            
            histVerts[i * 8 + 0] = horizOffsetRight;
            histVerts[i * 8 + 1] = vertSize;

            histVerts[i * 8 + 2] = horizOffsetLeft;
            histVerts[i * 8 + 3] = vertSize;

            histVerts[i * 8 + 4] = horizOffsetRight;
            histVerts[i * 8 + 5] = 0.0;

            histVerts[i * 8 + 6] = horizOffsetLeft;
            histVerts[i * 8 + 7] = 0.0;

            histIndices[i * 6 + 0] = (i * 4 + 0);
            histIndices[i * 6 + 1] = (i * 4 + 1);
            histIndices[i * 6 + 2] = (i * 4 + 2);

            histIndices[i * 6 + 3] = (i * 4 + 2);
            histIndices[i * 6 + 4] = (i * 4 + 1);
            histIndices[i * 6 + 5] = (i * 4 + 3);
        }

        // Bind the data to the VBOs
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, histVerts, gl.STATIC_DRAW);
        this.vertexPositionBuffer.itemSize = 2;
        this.vertexPositionBuffer.numItems = this.histogramBins * 4;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.elementIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, histIndices, gl.STATIC_DRAW);
        this.elementIndexBuffer.numItems = this.histogramBins * 6;

    },

    // Draw the histogram
    draw: function(pMatrix, mvMatrix, minVal, maxVal)
    {
        gl.useProgram(this.shaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute,
                               this.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.elementIndexBuffer);

        gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, new Float32Array(pMatrix.flatten()));
        gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, new Float32Array(mvMatrix.flatten()));

        var colorHist = [0.4, 0.4, 0.4, 1.0];
        gl.uniform4fv(this.shaderProgram.colorUniform, new Float32Array(colorHist));

        
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.drawElements(gl.TRIANGLES, this.elementIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        gl.disableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);


        // Generate and draw min/max lines
        var lineVerts = new Float32Array(8);
        var minLineX = (minVal - this.histogramRange[0]) / (this.histogramRange[1] - this.histogramRange[0]);
        var maxLineX = (maxVal - this.histogramRange[0]) / (this.histogramRange[1] - this.histogramRange[0]);
        lineVerts[0] = minLineX;
        lineVerts[1] = 1.0;
        lineVerts[2] = minLineX;
        lineVerts[3] = 0.0;
        lineVerts[4] = maxLineX;
        lineVerts[5] = 1.0;
        lineVerts[6] = maxLineX;
        lineVerts[7] = 0.0;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.minMaxPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, lineVerts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute,
                               2, gl.FLOAT, false, 0, 0);

        var colorLines = [0.9, 0.9, 0.9, 1.0];
        gl.uniform4fv(this.shaderProgram.colorUniform, new Float32Array(colorLines));


        gl.drawArrays(gl.LINES, 0, 4);

        gl.disableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

    }
    
    
}





