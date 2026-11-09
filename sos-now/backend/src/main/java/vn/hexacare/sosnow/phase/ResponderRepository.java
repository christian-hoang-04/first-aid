package vn.hexacare.sosnow.phase;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ResponderRepository extends JpaRepository<Responder, String> {
    @Override @EntityGraph(attributePaths = "skills") List<Responder> findAll();
    @Override @EntityGraph(attributePaths = "skills") Optional<Responder> findById(String id);
    @EntityGraph(attributePaths = "skills") Optional<Responder> findByTokenHash(String tokenHash);
}
