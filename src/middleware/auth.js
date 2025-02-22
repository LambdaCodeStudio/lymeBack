const jwt = require("jsonwebtoken");
const User = require("../models/user");
const ROLES = require("../constants/roles");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ msg: "No hay token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ msg: "Usuario no encontrado" });
    }

    // Verificar si el usuario temporal ha expirado
    if (user.role === ROLES.TEMPORAL) {
      if (!user.expiresAt) {
        await User.deleteOne({ _id: user._id });
        return res.status(401).json({ msg: "Usuario temporal inválido" });
      }

      if (user.expiresAt < new Date()) {
        await User.deleteOne({ _id: user._id });
        return res.status(401).json({ msg: "Usuario temporal expirado" });
      }
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({ msg: "Usuario inactivo" });
    }

    // Adjuntar el usuario a la request
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      expiresAt: user.expiresAt,
    };

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ msg: "Token inválido" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Token expirado" });
    }
    res.status(500).json({ msg: "Error del servidor" });
  }
};

module.exports = auth;
