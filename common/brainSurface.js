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
//  brainSurface.js
//
//  Description:
//      Provides an object for rendering FreeSurfer surface files
//      in JavaScript.
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//


BrainSurface = function()
{
    // MRIS file from which the object will be loaded
    this.mrisFile = new MRISFile();

    // Curvature file associated with the surface
    this.crvFile = new CRVFile();

    // WebGL buffer objects
    this.vertexPositionBuffer = null;
    this.vertexNormalBuffer = null;
    this.vertexCurvatureBuffer = null;

    // WebGL shader program
    this.shaderProgram = null;

    // Whether to render curvature
    this.drawCurvature = 0;

    // Curv min/max values
    this.curCurvMin = new Float32Array(1);
    this.curCurvMax = new Float32Array(1);
    this.curScale = new Float32Array(3);
    this.opacity = new Float32Array(1);

    // Callback functions
    this.surfaceCallback = null;
    this.curvatureCallback = null;

    // Fragment shader source - yeah, I should really load this
    // from an external file, but this works for now.
    this.fragShaderSrc =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +
        "varying vec4 vPosition;\n" +
        "varying vec3 vColor;\n" +
        "varying vec3 vNormal;\n" +
        "uniform float uOpacity;\n" +
        "void main(void) {\n" +
        "   vec3 normal = normalize(vNormal);\n" +
        "   vec3 lightVec = vec3(0.0, 0.0, 1.0);\n" +
        "   vec3 specLightDir = vec3(-10.0, 4.0, -20.0);\n" +
        "   specLightDir = normalize(specLightDir);\n" +

        "   vec3 eyeDirection = normalize(-vPosition.xyz);\n" +
        "   vec3 reflectionDirection = reflect(-specLightDir, normal);\n" +
        "   float specular = pow(max(dot(reflectionDirection, eyeDirection), 0.0), 16.0);\n" +

        "   float diffuse = 0.8 * max(dot(normal, lightVec), 0.0);\n" +
        "   float ambient = 0.2;\n" +
        "   gl_FragColor = vec4(\n" +
        "                   vColor * ambient +\n" +
        "                   vColor * diffuse +\n" +
        "                   vec3(1.0, 1.0, 1.0) * specular, uOpacity);\n" +
        "}\n";

    this.vertShaderSrc =
        "attribute vec3 aVertexPosition;\n" +
        "attribute vec3 aNormal;\n" +
        "attribute float aCurvature;\n" +

        "uniform mat4 uMVMatrix;\n" +
        "uniform mat4 uPMatrix;\n" +
        "uniform mat4 uNMatrix;\n" +
        "uniform vec3 center;\n" +
        "uniform float uCurvMax;\n" +
        "uniform float uCurvMin;\n" +
        "uniform int uDrawCurvature;\n" +
        "uniform int uThreshold;\n" +

        "varying vec3 vColor;\n" +
        "varying vec3 vNormal;\n" +
        "varying vec4 vPosition;\n" +
        "void main(void) {\n" +

        "  vec3 pos = aVertexPosition.xyz;" +

        "  if (uDrawCurvature != 0 )\n" +
        "  {\n" +
        "      float curvValue = (aCurvature - uCurvMin) / (uCurvMax - uCurvMin);\n" +
        "      if (uThreshold != 0)\n" +
        "      {\n" +           
        "           if (curvValue <= 0.0 || curvValue >= 1.0)\n" +
        "               vColor = vec3(0.5, 0.5, 0.5);\n" +
        "           else\n" +
        "               vColor = curvValue * vec3(1.0, 0.0, 0.0) + (1.0 - curvValue) * vec3(0.0, 1.0, 0.0);\n" +
        "      }\n" +
        "      else\n" +
        "      {\n" +
        "               vColor = curvValue * vec3(1.0, 0.0, 0.0) + (1.0 - curvValue) * vec3(0.0, 1.0, 0.0);\n" +
        "      }\n" +
        "  }\n" +
        "  else\n" +
        "  {\n" +
        "      vColor = vec3(0.5, 0.5, 0.5);\n" +
        "  }\n" +

        "  vNormal = vec3(uNMatrix * vec4(aNormal, 1.0));\n" +

        "  vPosition = uMVMatrix * vec4(pos, 1.0);\n" +
        "  gl_Position = uPMatrix * vPosition;\n" +
        "}\n";
}

// BrainSurface object
BrainSurface.prototype =
{
    // Load surface
    loadSurface: function(mrisURL, surfaceCallback)
    {
        this.surfaceCallback = surfaceCallback;
        var mrisLoader = new MRISLoader();        
        mrisLoader.load(mrisURL, this.handleLoadedSurface, this);
    },

    // Callback for handling loaded surface
    handleLoadedSurface: function(mrisFile, self)
    {
        self.mrisFile = mrisFile;

        self.createShaderProgram();

        self.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mrisFile.vertexPositionBuffer, gl.STATIC_DRAW);
        self.vertexPositionBuffer.itemSize = 3;
        self.vertexPositionBuffer.numItems = mrisFile.vertexPositionBuffer.length / 3;

        self.vertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexNormalBuffer);

        gl.bufferData(gl.ARRAY_BUFFER, mrisFile.vertexNormalBuffer, gl.STATIC_DRAW);
        self.vertexNormalBuffer.itemSize = 3;
        self.vertexNormalBuffer.numItems = mrisFile.vertexNormalBuffer.length / 3;

        var scale = mrisFile.scaleVect[0];
        for (var i = 1; i < 3; i++ )
        {
            if ( mrisFile.scaleVect[i] > scale )
                scale = mrisFile.scaleVect[i];
        }
        self.curScale[0] = self.curScale[1] = self.curScale[2] = scale;
        self.opacity[0] = 1.0;

        if (self.surfaceCallback != null)
            self.surfaceCallback(self);
    },

    // Load curvature
    loadCurvature: function(crvURL, curvatureCallback)
    {
        this.curvatureCallback = curvatureCallback;
        var crvLoader = new CRVLoader();
        crvLoader.load(crvURL, this.mrisFile, this.handleLoadedCurvature, this);
    },

    // Callback for handling loaded curvature
    handleLoadedCurvature: function(crvFile, self)
    {
        self.crvFile = crvFile;
        self.curCurvMin[0] = crvFile.minCurv[1];
        self.curCurvMax[0] = crvFile.maxCurv[1];

        self.drawCurvature = 1;

        self.vertexCurvatureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, self.vertexCurvatureBuffer);

        gl.bufferData(gl.ARRAY_BUFFER, crvFile.vertexCurvatureBuffer, gl.STATIC_DRAW);
        self.vertexCurvatureBuffer.itemSize = 1;
        self.vertexCurvatureBuffer.numItems = crvFile.vertexCurvatureBuffer.length;

        if (self.curvatureCallback != null)
            self.curvatureCallback(self);
    },

    // Draw the brain surface using WebGL
    drawSurface: function(pMatrix, mvMatrix, threshold)
    {
        gl.useProgram(this.shaderProgram);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute,
                               this.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexNormalAttribute, this.vertexNormalBuffer.itemSize,
                               gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexNormalAttribute);


        gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, new Float32Array(pMatrix.flatten()));
        gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, new Float32Array(mvMatrix.flatten()));

        var normalMatrix = mvMatrix.inverse();
        normalMatrix = normalMatrix.transpose();
        gl.uniformMatrix4fv(this.shaderProgram.nMatrixUniform, false, new Float32Array(normalMatrix.flatten()));
        
        gl.uniform3fv(this.shaderProgram.centerUniform, this.mrisFile.centerVect);
        gl.uniform1i(this.shaderProgram.drawCurvatureUniform, this.drawCurvature);
        gl.uniform1fv(this.shaderProgram.opacityUniform, this.opacity);
        gl.uniform1i(this.shaderProgram.thresholdUniform, threshold);

        if ( this.drawCurvature )
        {
            gl.uniform1fv(this.shaderProgram.curvMinUniform, this.curCurvMin);
            gl.uniform1fv(this.shaderProgram.curvMaxUniform, this.curCurvMax);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexCurvatureBuffer);
            gl.vertexAttribPointer(this.shaderProgram.vertexCurvatureAttribute,
                                   this.vertexCurvatureBuffer.itemSize, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(this.shaderProgram.vertexCurvatureAttribute);
        }
        else
        {
            gl.disableVertexAttribArray(this.shaderProgram.vertexCurvatureAttribute);
        }

        gl.drawArrays(gl.TRIANGLES, 0, this.vertexPositionBuffer.numItems);

        gl.disableVertexAttribArray(this.shaderProgram.vertexCurvatureAttribute);
        gl.disableVertexAttribArray(this.shaderProgram.vertexNormalAttribute);
        gl.disableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);

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

        this.shaderProgram.vertexNormalAttribute = gl.getAttribLocation(this.shaderProgram, "aNormal");
        gl.enableVertexAttribArray(this.shaderProgram.vertexNormalAttribute);

        this.shaderProgram.vertexCurvatureAttribute = gl.getAttribLocation(this.shaderProgram, "aCurvature");

        this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
        this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
        this.shaderProgram.nMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uNMatrix");
        this.shaderProgram.centerUniform = gl.getUniformLocation(this.shaderProgram, "center");
        this.shaderProgram.curvMinUniform = gl.getUniformLocation(this.shaderProgram, "uCurvMin");
        this.shaderProgram.curvMaxUniform = gl.getUniformLocation(this.shaderProgram, "uCurvMax");
        this.shaderProgram.drawCurvatureUniform = gl.getUniformLocation(this.shaderProgram, "uDrawCurvature");
        this.shaderProgram.opacityUniform = gl.getUniformLocation(this.shaderProgram, "uOpacity");
        this.shaderProgram.thresholdUniform = gl.getUniformLocation(this.shaderProgram, "uThreshold");
    },

    setOpacity: function(opacity)
    {
        this.opacity[0] = opacity;
    }

  
}

