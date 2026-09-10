#pragma once

#include <string>
#include <vector>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <cctype>
#include <iomanip>
#include <cmath>
#include <iostream>

namespace mini_json {

enum class Type {
    Null,
    Boolean,
    Number,
    String,
    Array,
    Object
};

class Value {
public:
    Type type_ = Type::Null;
    bool bool_val_ = false;
    double num_val_ = 0.0;
    std::string str_val_;
    std::vector<Value> arr_val_;
    std::map<std::string, Value> obj_val_;

    Value() : type_(Type::Null) {}
    Value(std::nullptr_t) : type_(Type::Null) {}
    Value(bool b) : type_(Type::Boolean), bool_val_(b) {}
    Value(int n) : type_(Type::Number), num_val_(n) {}
    Value(long n) : type_(Type::Number), num_val_(static_cast<double>(n)) {}
    Value(long long n) : type_(Type::Number), num_val_(static_cast<double>(n)) {}
    Value(unsigned int n) : type_(Type::Number), num_val_(n) {}
    Value(unsigned long n) : type_(Type::Number), num_val_(static_cast<double>(n)) {}
    Value(unsigned long long n) : type_(Type::Number), num_val_(static_cast<double>(n)) {}
    Value(double n) : type_(Type::Number), num_val_(n) {}
    Value(const char* s) : type_(Type::String), str_val_(s ? s : "") {}
    Value(const std::string& s) : type_(Type::String), str_val_(s) {}
    Value(std::vector<Value> arr) : type_(Type::Array), arr_val_(std::move(arr)) {}
    Value(std::map<std::string, Value> obj) : type_(Type::Object), obj_val_(std::move(obj)) {}

    static Value array() {
        Value v;
        v.type_ = Type::Array;
        return v;
    }

    static Value object() {
        Value v;
        v.type_ = Type::Object;
        return v;
    }

    bool is_null() const { return type_ == Type::Null; }
    bool is_boolean() const { return type_ == Type::Boolean; }
    bool is_number() const { return type_ == Type::Number; }
    bool is_string() const { return type_ == Type::String; }
    bool is_array() const { return type_ == Type::Array; }
    bool is_object() const { return type_ == Type::Object; }

    bool contains(const std::string& key) const {
        if (type_ != Type::Object) return false;
        return obj_val_.find(key) != obj_val_.end();
    }

    size_t size() const {
        if (type_ == Type::Array) return arr_val_.size();
        if (type_ == Type::Object) return obj_val_.size();
        return 0;
    }

    bool empty() const {
        return size() == 0;
    }

    Value& operator[](const std::string& key) {
        if (type_ == Type::Null) type_ = Type::Object;
        if (type_ != Type::Object) throw std::runtime_error("Not a JSON object");
        return obj_val_[key];
    }

    const Value& operator[](const std::string& key) const {
        if (type_ != Type::Object) throw std::runtime_error("Not a JSON object");
        auto it = obj_val_.find(key);
        if (it == obj_val_.end()) {
            static const Value null_val;
            return null_val;
        }
        return it->second;
    }

    Value& operator[](size_t idx) {
        if (type_ != Type::Array) throw std::runtime_error("Not a JSON array");
        return arr_val_.at(idx);
    }

    const Value& operator[](size_t idx) const {
        if (type_ != Type::Array) throw std::runtime_error("Not a JSON array");
        return arr_val_.at(idx);
    }

    void push_back(const Value& v) {
        if (type_ == Type::Null) type_ = Type::Array;
        if (type_ != Type::Array) throw std::runtime_error("Not a JSON array");
        arr_val_.push_back(v);
    }

    template <typename T>
    T get() const {
        if constexpr (std::is_same_v<T, std::string>) {
            if (type_ != Type::String) throw std::runtime_error("Value is not string");
            return str_val_;
        } else if constexpr (std::is_same_v<T, double>) {
            if (type_ != Type::Number) throw std::runtime_error("Value is not number");
            return num_val_;
        } else if constexpr (std::is_same_v<T, int>) {
            if (type_ != Type::Number) throw std::runtime_error("Value is not number");
            return static_cast<int>(num_val_);
        } else if constexpr (std::is_same_v<T, long long>) {
            if (type_ != Type::Number) throw std::runtime_error("Value is not number");
            return static_cast<long long>(num_val_);
        } else if constexpr (std::is_same_v<T, bool>) {
            if (type_ != Type::Boolean) throw std::runtime_error("Value is not bool");
            return bool_val_;
        } else {
            static_assert(!sizeof(T), "Unsupported type for get<T>()");
        }
    }

    template <typename T>
    T value(const std::string& key, const T& default_val) const {
        if (type_ != Type::Object || !contains(key)) return default_val;
        try {
            return (*this)[key].get<T>();
        } catch (...) {
            return default_val;
        }
    }

    std::string value(const std::string& key, const char* default_val) const {
        if (type_ != Type::Object || !contains(key)) return default_val ? default_val : "";
        try {
            return (*this)[key].get<std::string>();
        } catch (...) {
            return default_val ? default_val : "";
        }
    }

    std::string dump(int indent = -1, int curr_indent = 0) const {
        std::ostringstream ss;
        std::string ind_str = (indent > 0) ? std::string(curr_indent, ' ') : "";
        std::string next_ind = (indent > 0) ? std::string(curr_indent + indent, ' ') : "";
        std::string nl = (indent > 0) ? "\n" : "";
        std::string sp = (indent > 0) ? " " : "";

        switch (type_) {
            case Type::Null:
                ss << "null";
                break;
            case Type::Boolean:
                ss << (bool_val_ ? "true" : "false");
                break;
            case Type::Number: {
                if (std::floor(num_val_) == num_val_ && !std::isinf(num_val_)) {
                    ss << static_cast<long long>(num_val_);
                } else {
                    ss << std::setprecision(10) << num_val_;
                }
                break;
            }
            case Type::String: {
                ss << "\"";
                for (char c : str_val_) {
                    if (c == '\"') ss << "\\\"";
                    else if (c == '\\') ss << "\\\\";
                    else if (c == '\b') ss << "\\b";
                    else if (c == '\f') ss << "\\f";
                    else if (c == '\n') ss << "\\n";
                    else if (c == '\r') ss << "\\r";
                    else if (c == '\t') ss << "\\t";
                    else ss << c;
                }
                ss << "\"";
                break;
            }
            case Type::Array: {
                if (arr_val_.empty()) {
                    ss << "[]";
                } else {
                    ss << "[" << nl;
                    for (size_t i = 0; i < arr_val_.size(); ++i) {
                        ss << next_ind << arr_val_[i].dump(indent, curr_indent + (indent > 0 ? indent : 0));
                        if (i + 1 < arr_val_.size()) ss << ",";
                        ss << nl;
                    }
                    ss << ind_str << "]";
                }
                break;
            }
            case Type::Object: {
                if (obj_val_.empty()) {
                    ss << "{}";
                } else {
                    ss << "{" << nl;
                    size_t count = 0;
                    for (const auto& [k, v] : obj_val_) {
                        ss << next_ind << "\"" << k << "\":" << sp << v.dump(indent, curr_indent + (indent > 0 ? indent : 0));
                        if (++count < obj_val_.size()) ss << ",";
                        ss << nl;
                    }
                    ss << ind_str << "}";
                }
                break;
            }
        }
        return ss.str();
    }
};

class Parser {
    const std::string& src_;
    size_t pos_ = 0;

    void skip_whitespace() {
        while (pos_ < src_.size() && (std::isspace(src_[pos_]) || src_[pos_] == '\0')) {
            pos_++;
        }
    }

    char peek() {
        skip_whitespace();
        return (pos_ < src_.size()) ? src_[pos_] : '\0';
    }

    char get() {
        skip_whitespace();
        return (pos_ < src_.size()) ? src_[pos_++] : '\0';
    }

    std::string parse_string() {
        if (get() != '\"') throw std::runtime_error("Expected '\"' at pos " + std::to_string(pos_));
        std::string s;
        while (pos_ < src_.size()) {
            char c = src_[pos_++];
            if (c == '\"') return s;
            if (c == '\\') {
                if (pos_ >= src_.size()) throw std::runtime_error("Unexpected EOF after \\");
                char esc = src_[pos_++];
                switch (esc) {
                    case '\"': s += '\"'; break;
                    case '\\': s += '\\'; break;
                    case '/':  s += '/';  break;
                    case 'b':  s += '\b'; break;
                    case 'f':  s += '\f'; break;
                    case 'n':  s += '\n'; break;
                    case 'r':  s += '\r'; break;
                    case 't':  s += '\t'; break;
                    case 'u': {
                        // skip 4 hex digits
                        std::string hex = src_.substr(pos_, 4);
                        pos_ += 4;
                        int code = std::stoi(hex, nullptr, 16);
                        if (code < 0x80) s += static_cast<char>(code);
                        else if (code < 0x800) {
                            s += static_cast<char>(0xC0 | (code >> 6));
                            s += static_cast<char>(0x80 | (code & 0x3F));
                        } else {
                            s += static_cast<char>(0xE0 | (code >> 12));
                            s += static_cast<char>(0x80 | ((code >> 6) & 0x3F));
                            s += static_cast<char>(0x80 | (code & 0x3F));
                        }
                        break;
                    }
                    default: s += esc; break;
                }
            } else {
                s += c;
            }
        }
        throw std::runtime_error("Unterminated string");
    }

    Value parse_number() {
        size_t start = pos_;
        if (src_[pos_] == '-') pos_++;
        while (pos_ < src_.size() && (std::isdigit(src_[pos_]) || src_[pos_] == '.' || src_[pos_] == 'e' || src_[pos_] == 'E' || src_[pos_] == '+' || src_[pos_] == '-')) {
            pos_++;
        }
        std::string sub = src_.substr(start, pos_ - start);
        return Value(std::stod(sub));
    }

public:
    explicit Parser(const std::string& src) : src_(src) {}

    Value parse_value() {
        char c = peek();
        if (c == '{') {
            get();
            Value obj = Value::object();
            if (peek() == '}') {
                get();
                return obj;
            }
            while (true) {
                if (peek() != '\"') throw std::runtime_error("Expected string key in object at pos " + std::to_string(pos_));
                std::string key = parse_string();
                if (get() != ':') throw std::runtime_error("Expected ':' after key in object");
                Value val = parse_value();
                obj[key] = std::move(val);
                char next = peek();
                if (next == ',') {
                    get();
                    continue;
                } else if (next == '}') {
                    get();
                    break;
                } else {
                    throw std::runtime_error("Expected ',' or '}' in object");
                }
            }
            return obj;
        } else if (c == '[') {
            get();
            Value arr = Value::array();
            if (peek() == ']') {
                get();
                return arr;
            }
            while (true) {
                Value val = parse_value();
                arr.push_back(std::move(val));
                char next = peek();
                if (next == ',') {
                    get();
                    continue;
                } else if (next == ']') {
                    get();
                    break;
                } else {
                    throw std::runtime_error("Expected ',' or ']' in array");
                }
            }
            return arr;
        } else if (c == '\"') {
            return Value(parse_string());
        } else if (std::isdigit(c) || c == '-') {
            return parse_number();
        } else if (c == 't' && src_.compare(pos_, 4, "true") == 0) {
            pos_ += 4;
            return Value(true);
        } else if (c == 'f' && src_.compare(pos_, 5, "false") == 0) {
            pos_ += 5;
            return Value(false);
        } else if (c == 'n' && src_.compare(pos_, 4, "null") == 0) {
            pos_ += 4;
            return Value(nullptr);
        }
        throw std::runtime_error("Unexpected character '" + std::string(1, c) + "' at pos " + std::to_string(pos_));
    }

    static Value parse(const std::string& str) {
        Parser p(str);
        return p.parse_value();
    }
};

} // namespace mini_json

namespace nlohmann {
    using json = mini_json::Value;
}
