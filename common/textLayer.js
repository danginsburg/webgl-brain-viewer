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
//  textLayer.js
//
//  Description:
//      Renders text to a 2D canvas and then places result in texture.  Used
//      to display text
//
//  Author:
//      Dan Ginsburg (daniel.ginsburg@childrens.harvard.edu)
//      Children's Hospital Boston
//

TextLayer = function(canvasName)
{
    this.textTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.textTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    
    // 2D context
    this.context = null;
    this.image = null;
    
    
    // Initialize VBOs
    var vertices = [
            1.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0
        ];
    var texCoords = [
            1.0, 0.0,
            0.0, 0.0,
            1.0, 1.0,
            0.0, 1.0
        ];

    this.vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.vertexPositionBuffer.itemSize = 2;
    this.vertexPositionBuffer.numItems = 4;

    this.vertexTexCoordsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTexCoordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
    this.vertexTexCoordsBuffer.itemSize = 2;
    this.vertexTexCoordsBuffer.numItems = 4;


    // Initialize shaders
    this.fragShaderSrc =
        "#ifdef GL_ES\n" +
        "precision highp float;\n" +
        "#endif\n" +
        "uniform sampler2D sTextTexture;\n" +
        "varying vec2 vTexCoords;\n" +
        "void main(void) {\n" +
        "   gl_FragColor = texture2D(sTextTexture, vTexCoords.xy);\n" +
        "   gl_FragColor.a = 0.0;\n" +
        "}\n";

    this.vertShaderSrc =
        "attribute vec3 aVertexPosition;\n" +
        "attribute vec2 aTexCoords;\n" +
        "varying vec2 vTexCoords;\n" +

        "uniform mat4 uMVMatrix;\n" +
        "uniform mat4 uPMatrix;\n" +

        "void main(void) {\n" +

        "  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition.xyz, 1.0);\n" +
        "  vTexCoords = aTexCoords;\n" +
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
    this.shaderProgram.vertexTexCoordsAttribute = gl.getAttribLocation(this.shaderProgram, "aTexCoords");

    this.shaderProgram.pMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uPMatrix");
    this.shaderProgram.mvMatrixUniform = gl.getUniformLocation(this.shaderProgram, "uMVMatrix");
    this.shaderProgram.textTextureUniform = gl.getUniformLocation(this.shaderProgram, "sTextTexture");
}

// Text layer object
TextLayer.prototype =
{
    // Start rendering text
    startRendering: function(canvasName)
    {
        this.image = document.getElementById(canvasName);
        this.context = this.image.getContext('2d');

        this.context.fillStyle = 'black';
        this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.context.fillStyle = 'white';
        this.context.lineWidth = 3;
        this.context.strokeStyle = 'white';
        this.context.save();
        this.context.font = "bold 8px Verdana";
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';
    },

    // Finish rendering text and display on top of GL canvas
    endRendering: function()
    {
        this.context.restore();

        // Set the 2D canvas to the texture image pixels
        gl.enable(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, this.textTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);


        // Draw quad on screen
        gl.useProgram(this.shaderProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute,
                               this.vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexTexCoordsBuffer);
        gl.vertexAttribPointer(this.shaderProgram.vertexTexCoordsAttribute,
                               this.vertexTexCoordsBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.shaderProgram.vertexTexCoordsAttribute);


        var pMatrix = makeOrtho(0.0, 1.0, 0.0, 1.0, -1.0, 1.0);
        var mvMatrix = Matrix.I(4);
        
        gl.uniform1i(this.shaderProgram.textTextureUniform, 0);
        gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, new Float32Array(pMatrix.flatten()));
        gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, new Float32Array(mvMatrix.flatten()));

        
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertexPositionBuffer.numItems);

        gl.disableVertexAttribArray(this.shaderProgram.vertexPositionAttribute);
        gl.disableVertexAttribArray(this.shaderProgram.vertexTexCoordsAttribute);
        gl.disable(gl.TEXTURE_2D);
        gl.enable(gl.DEPTH_TEST);

    },

    // Draw text
    drawText: function(x, y, text)
    {
        var xOffset = (x * this.context.canvas.width);
        var yOffset = (y * this.context.canvas.height);        
        this.context.fillText(text, xOffset, yOffset);
    }
}



