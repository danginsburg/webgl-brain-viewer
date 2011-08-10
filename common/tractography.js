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
//  tractography.js
//
//  Description:
//      Provides an object for rendering Diffusion Toolkit 'trk' files
//      in JavaScript.
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//


Tractography = function()
{
    // TRK file from which the object will be loaded
    this.trkFile = new TrackFile();


    // WebGL buffer objects
    this.vertexPositionBuffer = null;
    this.vertexColorBuffer = null;

    // WebGL shader program
    this.shaderProgram = null;


    // Scale and center
    this.trackScale = new Float32Array(3);
    this.trackCenter = new Float32Array(3);
    this.minTrackLength = new Float32Array(1);


    // Fragment shader source - yeah, I should really load this
    // from an external file, but this works for now.
    this.fragShaderSrc =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +

        "varying vec4 vPosition;\n" +
        "varying vec3 vColor;\n" +
        "varying vec3 vNormal;\n" +
        "void main(void) {\n" +
        "   vec3 normal = normalize(vNormal);\n" +
        "   vec3 lightVec = vec3(0.0, 0.0, 1.0);\n" +
        "   vec3 specLightDir = vec3(-2, -1.0, 0.5);\n" +

        "   vec3 eyeDirection = normalize(-vPosition.xyz);\n" +
        "   vec3 reflectionDirection = reflect(-specLightDir, normal);\n" +
        "   float specular = pow(max(dot(reflectionDirection, eyeDirection), 0.0), 8.0);\n" +

        "   float diffuse = 0.8 * max(dot(normal, lightVec), 0.0);\n" +
        "   float ambient = 0.2;\n" +
        "   gl_FragColor = vec4(\n" +
        "       vColor * ambient +\n" +
        "       vColor * diffuse, 1.0);\n" +
        "}\n";

    this.vertShaderSrc =
        "attribute vec4 aVertexPosition;\n" +
        "attribute vec3 aColor;\n" +

        "uniform mat4 uMVMatrix;\n" +
        "uniform mat4 uPMatrix;\n" +
        "uniform mat4 uNMatrix;\n" +
        "uniform float uMinTrackLength;\n" +
        "uniform vec3 center;\n" +

        "varying vec3 vColor;\n" +
        "varying vec3 vNormal;\n" +
        "varying vec4 vPosition;\n" +
        "void main(void) {\n" +

        "   vec3 pos = aVertexPosition.xyz;\n" +
        "   float length = aVertexPosition.w;\n" +
        "   if (length < uMinTrackLength)\n" +
        "       pos = vec3(0.0);\n" +
        "   vColor = aColor;\n" +

        "   vec3 normal = normalize(pos - center);\n" +
        "   vNormal = vec3(uNMatrix * vec4(normal, 1.0));\n" +

        "   vPosition = uMVMatrix * vec4(pos, 1.0);\n" +
        "   gl_Position = uPMatrix * vPosition;\n" +

        "}\n";
}

// Tractography object
Tractography.prototype =
{
    // Load tracks
    loadTracks: function(trkURL)
    {
        var trkLoader = new TrkLoader();
        trkLoader.load(trkURL, this.handleLoadedTracks, this);
    },

    // Callback for handling loaded Tracks
    handleLoadedTracks: function(trkFile, self)
    {
        self.trkFile = trkFile;

        self.createShaderProgram();

        self.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexPositionBuffer);

        gl.bufferData(gl.ARRAY_BUFFER, trkFile.vertexPositionBuffer, gl.STATIC_DRAW);
        self.vertexPositionBuffer.itemSize = 4;
        self.vertexPositionBuffer.numItems = trkFile.vertexPositionBuffer.length / 4;

        self.vertexColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexColorBuffer);

        gl.bufferData(gl.ARRAY_BUFFER, trkFile.vertexColorBuffer, gl.STATIC_DRAW);
        self.vertexColorBuffer.itemSize = 3;
        self.vertexColorBuffer.numItems = trkFile.vertexColorBuffer.length / 3;

        self.trackScale = trkFile.scaleVect;
        self.trackCenter = trkFile.centerVect;
        self.minTrackLength[0] = 15.0; // a reasonable default
    },

    // Draw the brain tracks using WebGL
    drawTracks: function(pMatrix, mvMatrix)
    {

        gl.useProgram(this.shaderProgram);


        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute,
                               this.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexColorBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexColorAttribute,
                               this.vertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexColorAttribute);


        gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, new Float32Array(pMatrix.flatten()));
        gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, new Float32Array(mvMatrix.flatten()));

        var normalMatrix = mvMatrix.inverse();
        normalMatrix = normalMatrix.transpose();
        gl.uniformMatrix4fv(this.shaderProgram.nMatrixUniform, false, new Float32Array(normalMatrix.flatten()));


        gl.uniform3fv(this.shaderProgram.centerUniform, this.trackCenter);
        gl.uniform1fv(this.shaderProgram.minTrackLengthUniform, this.minTrackLength);

        gl.drawArrays(gl.LINES, 0, this.vertexPositionBuffer.numItems);

        gl.disableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
        gl.disableVertexAttribArray(this.shaderProgram.vertexColorAttribute);

    },

    createShaderProgram: function()
    {
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
        gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

        this.shaderProgram.vertexColorAttribute = gl.getAttribLocation(this.shaderProgram, "aColor");
        gl.enableVertexAttribArray(this.shaderProgram.vertexColorAttribute);

        this.shaderProgram.vertexCurvatureAttribute = gl.getAttribLocation(this.shaderProgram, "aCurvature");

        this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
        this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
        this.shaderProgram.nMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uNMatrix");
        this.shaderProgram.minTrackLengthUniform = gl.getUniformLocation(this.shaderProgram, "uMinTrackLength");
        this.shaderProgram.centerUniform = gl.getUniformLocation(this.shaderProgram, "center");
    },

    setMinTrackLength: function(minTrackLength)
    {
        this.minTrackLength[0] = minTrackLength;
    }

}

