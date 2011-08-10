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
//  connectome.js
//
//  Description:
//      Provides an object for reading and rendering connectivity data
//      from the Connectome Mapping Toolkit (http://www.cmtk.org)
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//

Connectome = function()
{

    this.edgesFile = null;
    this.nodesFile = null;

    // Callback functions
    this.nodesConnectomeCallback = null;
    this.edgesConnectomeCallback = null;

    // WebGL shader program
    this.nodesShaderProgram = null;
    this.edgesShaderProgram = null;

    // Nodes VBO
    this.nodesVertexPositionBuffer = null;
    this.nodesVertexNormalBuffer = null;
    this.nodesIndexBuffer = null;
    this.nodesNumIndices = 0;

    // Edges VBO
    this.edgesVertexPositionBuffer = null;
    this.edgesVertexColorBuffer = null;

    this.nodesFragShaderSrc =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +
        "varying vec3 vNormal;\n" +
        "void main(void) {\n" +
        "   vec3 normal = normalize(vNormal);\n" +
        "   vec3 lightVec = vec3(0.0, 0.0, 1.0);\n" +        
        "   float diffuse = 1.0 * max(dot(normal, lightVec), 0.0);\n" +
        "   gl_FragColor = vec4(diffuse, diffuse, diffuse, 1.0);\n" +
        "}\n";

    this.nodesVertShaderSrc =
        "attribute vec3 aVertexPosition;\n" +
        "attribute vec3 aNormal;\n" +
        
        "uniform mat4 uMVMatrix;\n" +
        "uniform mat4 uPMatrix;\n" +
        "uniform mat4 uNMatrix;\n" +
        
        "varying vec3 vNormal;\n" +
        "void main(void) {\n" +

        "  vec3 pos = aVertexPosition.xyz;" +                
        "  vNormal = vec3(uNMatrix * vec4(aNormal, 1.0));\n" +

        "  vec4 position = uMVMatrix * vec4(pos, 1.0);\n" +
        "  gl_Position = uPMatrix * position;\n" +
        "}\n";


    this.edgesFragShaderSrc =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +
        "varying vec3 vColor;\n" +
        "void main(void) {\n" +
        "   gl_FragColor = vec4(vColor, 1.0);\n" +
        "}\n";

    this.edgesVertShaderSrc =
        "attribute vec3 aVertexPosition;\n" +
        "attribute vec3 aColor;\n" +
        
        "uniform mat4 uMVMatrix;\n" +
        "uniform mat4 uPMatrix;\n" +
        "uniform mat4 uNMatrix;\n" +

        "varying vec3 vColor;\n" +
        "void main(void) {\n" +

        "  vec3 pos = aVertexPosition.xyz;" +
        "  vec4 position = uMVMatrix * vec4(pos, 1.0);\n" +
        "  gl_Position = uPMatrix * position;\n" +
        "  vColor = aColor;\n" +
        "}\n";

}



// Connectome object
Connectome.prototype =
{
    // Load connectome
    loadConnectome: function(nodesURL, edgesURL, nodesConnectomeCallback, edgesConnectomeCallback)
    {
        this.nodesConnectomeCallback = nodesConnectomeCallback;
        this.edgesConnectomeCallback = edgesConnectomeCallback;
        var connectomeLoader = new ConnectomeLoader();
        connectomeLoader.load(nodesURL, edgesURL, this.handleLoadedNodes,
                              this.handleLoadedEdges, this);
    },

    // Callback for handling loaded nodes
    handleLoadedNodes: function(nodesFile, self)
    {
        self.nodesFile = nodesFile;

        self.nodesShaderProgram = self.createShaderProgram(self.nodesFragShaderSrc,
                                                           self.nodesVertShaderSrc);
                
        gl.useProgram(self.nodesShaderProgram);

        self.nodesShaderProgram.vertexPositionAttribute = gl.getAttribLocation(self.nodesShaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(self.nodesShaderProgram.vertexPositionAttribute);

        self.nodesShaderProgram.vertexNormalAttribute = gl.getAttribLocation(self.nodesShaderProgram, "aNormal");
        gl.enableVertexAttribArray(self.nodesShaderProgram.vertexNormalAttribute);

        self.nodesShaderProgram.pMatrixUniform = gl.getUniformLocation(self.nodesShaderProgram, "uPMatrix");
        self.nodesShaderProgram.mvMatrixUniform = gl.getUniformLocation(self.nodesShaderProgram, "uMVMatrix");
        self.nodesShaderProgram.nMatrixUniform = gl.getUniformLocation(self.nodesShaderProgram, "uNMatrix");

        var cubeData = esGenCube(2.0, true, true, false, true);
        var numVertices = 24;
        var numIndices = 36;
        var vertices = new Float32Array(numVertices * nodesFile.numNodes * 3);
        var normals = new Float32Array(numVertices * nodesFile.numNodes * 3);
        var indices = new Uint16Array(numIndices * nodesFile.numNodes);

        for( var i = 0; i < nodesFile.numNodes; i++ )
        {
            // Offset the cube by the node positions
            for (var vert = 0; vert < numVertices; vert ++ )
            {
                var vertIndex = (i * numVertices) + vert;
                vertices[vertIndex * 3 + 0] = cubeData.vertices[vert * 3 + 0] + nodesFile.nodePositions[i * 3 + 0];
                vertices[vertIndex * 3 + 1] = cubeData.vertices[vert * 3 + 1] + nodesFile.nodePositions[i * 3 + 1];
                vertices[vertIndex * 3 + 2] = cubeData.vertices[vert * 3 + 2] + nodesFile.nodePositions[i * 3 + 2];
                normals[vertIndex * 3 + 0] = cubeData.normals[vert * 3 + 0];
                normals[vertIndex * 3 + 1] = cubeData.normals[vert * 3 + 1];
                normals[vertIndex * 3 + 2] = cubeData.normals[vert * 3 + 2];
            }

            // Offset the indices by the number of vertices used so far
            for (var index = 0; index < numIndices; index++ )
            {
                indices[(numIndices * i) + index] = cubeData.indices[index] + (numVertices * i);
            }
        }

        // Create a cube vertex buffer, one for each of the nodes
        self.nodesVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.nodesVertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        self.nodesVertexPositionBuffer.itemSize = 3;
        self.nodesVertexPositionBuffer.numItems = vertices.length / 3;

        self.nodesVertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.nodesVertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        self.nodesVertexNormalBuffer.itemSize = 3;
        self.nodesVertexNormalBuffer.numItems = normals.length / 3;

        self.nodesIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, self.nodesIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        self.nodesNumIndices = indices.length;

        if (self.nodesConnectomeCallback != null)
            self.nodesConnectomeCallback(self);

        // In case the ordering is backwards (edges got loaded first).
        if (self.edgesFile != null)
            handleLoadedEdges(self.edgesFile, self)
    },

    // Callback for handling loaded edges
    handleLoadedEdges: function(edgesFile, self)
    {
        self.edgesFile = edgesFile;

        // If nodesFiles has not yet been loaded, return, as this will get called later.
        // This would only happen if edges got loaded before nodes
        if (self.nodesFile == null)
            return;

        self.edgesShaderProgram = self.createShaderProgram(self.edgesFragShaderSrc,
                                                           self.edgesVertShaderSrc);

        gl.useProgram(self.edgesShaderProgram);

        self.edgesShaderProgram.vertexPositionAttribute = gl.getAttribLocation(self.edgesShaderProgram, "aVertexPosition");
        gl.enableVertexAttribArray(self.edgesShaderProgram.vertexPositionAttribute);

        self.edgesShaderProgram.vertexColorAttribute = gl.getAttribLocation(self.edgesShaderProgram, "aColor");
        gl.enableVertexAttribArray(self.edgesShaderProgram.vertexColorAttribute);

        self.edgesShaderProgram.pMatrixUniform = gl.getUniformLocation(self.edgesShaderProgram, "uPMatrix");
        self.edgesShaderProgram.mvMatrixUniform = gl.getUniformLocation(self.edgesShaderProgram, "uMVMatrix");
        self.edgesShaderProgram.nMatrixUniform = gl.getUniformLocation(self.edgesShaderProgram, "uNMatrix");

        var numVerts = edgesFile.edgeList.length * 2;
        var vertices = new Float32Array(numVerts * 3);
        var colors = new Float32Array(numVerts * 3);
        var vert = 0;
        for (var edgeIdx = 0; edgeIdx < edgesFile.edgeList.length; edgeIdx++ )
        {
            var edge = edgesFile.edgeList[edgeIdx];

            var numFiberWeight = edge.numberOfFibers / (edgesFile.maxNumFibers - edgesFile.minNumFibers);
            var lengthMeanWeight = edge.fiberLengthMean / (edgesFile.maxFiberLengthMean - edgesFile.minFiberLengthMean);
            var highColor = [ 1.0, 0.0, 0.0 ];
            var lowColor = [ 0.25, 0.0, 0.0 ];
            var color = Array(3);
            for (var c = 0; c < 3; c++)
            {
                color[c] = lengthMeanWeight * highColor[c] +
                           (1.0 - lengthMeanWeight) * lowColor[c];
            }



            vertices[vert * 3 + 0] = self.nodesFile.nodePositions[edge.nodeIndex0 * 3 + 0];
            vertices[vert * 3 + 1] = self.nodesFile.nodePositions[edge.nodeIndex0 * 3 + 1];
            vertices[vert * 3 + 2] = self.nodesFile.nodePositions[edge.nodeIndex0 * 3 + 2];
            colors[vert * 3 + 0] = color[0];
            colors[vert * 3 + 1] = color[1]
            colors[vert * 3 + 2] = color[2];
            vert++;

            vertices[vert * 3 + 0] = self.nodesFile.nodePositions[edge.nodeIndex1 * 3 + 0];
            vertices[vert * 3 + 1] = self.nodesFile.nodePositions[edge.nodeIndex1 * 3 + 1];
            vertices[vert * 3 + 2] = self.nodesFile.nodePositions[edge.nodeIndex1 * 3 + 2];
            colors[vert * 3 + 0] = color[0];
            colors[vert * 3 + 1] = color[1];
            colors[vert * 3 + 2] = color[2];
            vert++;

        }
        // Create vertex buffer for the edges
        self.edgesVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.edgesVertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        self.edgesVertexPositionBuffer.itemSize = 3;
        self.edgesVertexPositionBuffer.numItems = vertices.length / 3;

        self.edgesVertexColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.edgesVertexColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        self.edgesVertexColorBuffer.itemSize = 3;
        self.edgesVertexColorBuffer.numItems = colors.length / 3;
        
        if (self.edgesConnectomeCallback != null)
            self.edgesConnectomeCallback(self);
    },


    // Draw the connectome Nodes
    drawConnectomeNodes: function(pMatrix, mvMatrix)
    {
        gl.useProgram(this.nodesShaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.nodesVertexPositionBuffer);
        gl.vertexAttribPointer(this.nodesShaderProgram.vertexPositionAttribute,
                               this.nodesVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.nodesShaderProgram.vertexPositionAttribute);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.nodesVertexNormalBuffer);
        gl.vertexAttribPointer(this.nodesShaderProgram.vertexNormalAttribute, this.nodesVertexNormalBuffer.itemSize,
                               gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.nodesShaderProgram.vertexNormalAttribute);


        gl.uniformMatrix4fv(this.nodesShaderProgram.pMatrixUniform, false, new Float32Array(pMatrix.flatten()));
        gl.uniformMatrix4fv(this.nodesShaderProgram.mvMatrixUniform, false, new Float32Array(mvMatrix.flatten()));

        var normalMatrix = mvMatrix.inverse();
        normalMatrix = normalMatrix.transpose();
        gl.uniformMatrix4fv(this.nodesShaderProgram.nMatrixUniform, false, new Float32Array(normalMatrix.flatten()));

        // Load the index buffer
        gl.bindBuffer ( gl.ELEMENT_ARRAY_BUFFER, this.nodesIndexBuffer );

        gl.drawElements( gl.TRIANGLES, this.nodesNumIndices, gl.UNSIGNED_SHORT, 0);
        

        gl.disableVertexAttribArray(this.nodesShaderProgram.nodesVertexPositionBuffer);
        gl.disableVertexAttribArray(this.nodesShaderProgram.nodesVertexNormalBuffer);
    },

    // Draw the connectome Edges
    drawConnectomeEdges: function(pMatrix, mvMatrix)
    {
        gl.useProgram(this.edgesShaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.edgesVertexPositionBuffer);
        gl.vertexAttribPointer(this.edgesShaderProgram.vertexPositionAttribute,
                               this.edgesVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.edgesShaderProgram.vertexPositionAttribute);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.edgesVertexColorBuffer);
        gl.vertexAttribPointer(this.edgesShaderProgram.vertexColorAttribute, this.edgesVertexColorBuffer.itemSize,
                               gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.edgesShaderProgram.vertexColorAttribute);


        gl.uniformMatrix4fv(this.edgesShaderProgram.pMatrixUniform, false, new Float32Array(pMatrix.flatten()));
        gl.uniformMatrix4fv(this.edgesShaderProgram.mvMatrixUniform, false, new Float32Array(mvMatrix.flatten()));
        
        // Draw the lines
        gl.lineWidth (2.0);
        gl.drawArrays( gl.LINES, 0, this.edgesVertexPositionBuffer.numItems);
        gl.lineWidth (1.0);

        gl.disableVertexAttribArray(this.edgesShaderProgram.edgesVertexPositionBuffer);
        gl.disableVertexAttribArray(this.edgesShaderProgram.edgesVertexColorBuffer);
    },

    createShaderProgram: function(fragShaderSrc, vertShaderSrc)
    {
        var fragmentShader = compileShader(fragShaderSrc, gl.FRAGMENT_SHADER);
        var vertexShader = compileShader(vertShaderSrc, gl.VERTEX_SHADER);

        var shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert("Could not initialise shaders");
        }

        return shaderProgram;
    },

    setOpacity: function(opacity)
    {
        this.opacity[0] = opacity;
    }


}



