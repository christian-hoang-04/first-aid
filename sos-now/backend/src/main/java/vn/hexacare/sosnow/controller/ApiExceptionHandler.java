package vn.hexacare.sosnow.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = FacilityController.class)
public class ApiExceptionHandler {
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ProblemDetail invalidParameter(Exception ignored) {
        // Never echo rejected coordinate values, query strings or exception messages.
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Missing or invalid search parameters.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail invalidSearch(ResponseStatusException exception) {
        return ProblemDetail.forStatusAndDetail(exception.getStatusCode(), exception.getReason());
    }
}
